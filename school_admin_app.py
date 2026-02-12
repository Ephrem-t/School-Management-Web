from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
import os
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime
import sys




app = Flask(__name__)
CORS(app)

# ---------------- FIREBASE ---------------- #
# Cloud Run best practice: use Application Default Credentials (the Cloud Run service account)
# instead of baking a JSON key into the container.
firebase_json = os.environ.get(
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "ethiostore-17d9f-firebase-adminsdk-5e87k-ff766d2648.json",
)

database_url = os.environ.get(
    "FIREBASE_DATABASE_URL",
    "https://ethiostore-17d9f-default-rtdb.firebaseio.com/",
)
storage_bucket = os.environ.get(
    "FIREBASE_STORAGE_BUCKET",
    "ethiostore-17d9f.appspot.com",
)

try:
    if os.path.exists(firebase_json):
        cred = credentials.Certificate(firebase_json)
    else:
        cred = credentials.ApplicationDefault()

    firebase_admin.initialize_app(cred, {
        "databaseURL": database_url,
        "storageBucket": storage_bucket,
    })
except Exception as e:
    print("Firebase init failed:", e)
    # Don't hard-exit here; allows the container to boot for debugging/health checks.
    bucket = None

# Ensure we only access the storage bucket if initialization succeeded
try:
    # This will raise if firebase wasn't initialized or credentials missing
    if 'bucket' not in globals() or globals().get('bucket') is None:
        bucket = storage.bucket()
except Exception as e:
    print("Failed to get storage bucket:", e)
    bucket = None

# ---------------- REFERENCES ---------------- #
school_admin_ref = db.reference("School_Admins")
users_ref = db.reference("Users")
posts_ref = db.reference("Posts")
chats_ref = db.reference("Chats")  # Chats node for messages

# ---------------- FILE UPLOAD ---------------- #
def upload_file_to_firebase(file, folder=""):
    try:
        if not globals().get('bucket'):
            print("Upload skipped: storage bucket not available")
            return ""
        filename = secure_filename(file.filename)
        unique_name = f"{folder}/{uuid.uuid4().hex}_{filename}"
        blob = bucket.blob(unique_name)
        blob.upload_from_file(file, content_type=file.content_type)
        blob.make_public()
        return blob.public_url
    except Exception as e:
        print("Upload Error:", e)
        return ""




@app.route("/api/register", methods=["POST"])
def register_admin():
    from datetime import datetime

    data = request.form
    name = data.get("name")
    password = data.get("password")
    email = data.get("email")
    gender = data.get("gender")
    phone = data.get("phone")
    title = data.get("title")
    profile = request.files.get("profile")

    users_ref = db.reference("Users")
    admins_ref = db.reference("School_Admins")
    counters_ref = db.reference("counters/school_admins")

    # Check required fields (username removed, will be generated)
    if not name or not password or not email:
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    # Email duplicate check
    users = users_ref.get() or {}
    for u in users.values():
        if u.get("email") == email:
            return jsonify({"success": False, "message": "Email already in use!"}), 400

    # ==== Atomic adminId generation: GEM_<####>_<YY>
    try:
        # Defensive: scan max existing value
        existing_admins = admins_ref.get() or {}
        max_found = 0
        for a in existing_admins.values():
            aid = a.get("adminId") or ""
            if aid.startswith("GEM_"):
                parts = aid.split('_')
                if len(parts) == 3:
                    try:
                        seq = int(parts[1].lstrip("0") or "0")
                        if seq > max_found:
                            max_found = seq
                    except Exception:
                        continue

        # Counter bump up
        curr_counter = counters_ref.get() or 0
        if curr_counter < max_found:
            counters_ref.set(max_found)

        def tx_inc(val): return (val or 0) + 1
        new_seq = counters_ref.transaction(tx_inc)
        if not isinstance(new_seq, int): new_seq = int(new_seq)
        year = datetime.utcnow().year
        year_suf = str(year)[-2:]
        num_padded = str(new_seq).zfill(4)
        admin_id = f"GEM_{num_padded}_{year_suf}"

        # Unlikely collision: increment until unique
        attempts = 0
        while admins_ref.child(admin_id).get():
            new_seq += 1
            num_padded = str(new_seq).zfill(4)
            admin_id = f"GEM_{num_padded}_{year_suf}"
            attempts += 1
            if attempts > 1000:
                admin_id = f"GEM_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suf}"
                break
    except Exception:
        admin_id = f"GEM_{str(int(datetime.utcnow().timestamp()))[-6:]}_{year_suf}"

    # Profile image if present
    profile_url = ""
    if profile:
        profile_url = upload_file_to_firebase(profile, folder="profiles")

    # ==== Create user (username = adminId by default)
    new_user = users_ref.push()
    user_data = {
        "userId": new_user.key,
        "name": name,
        "username": admin_id,  # <-- username is always adminId
        "password": password,
        "email": email,
        "gender": gender,
        "phone": phone,
        "profileImage": profile_url,
        "role": "School_Admins",
        "isActive": True,
    }
    new_user.set(user_data)

    # ==== Create School_Admins/<adminId>
    admin_data = {
        "adminId": admin_id,
        "userId": new_user.key,
        "status": "active",
        "title": title,
    }
    admins_ref.child(admin_id).set(admin_data)

    return jsonify({"success": True, "message": "Registration successful!", "adminId": admin_id})

# ---------------- LOGIN ADMIN ---------------- #
@app.route("/api/login", methods=["POST"])
def login_admin():
    try:
        data = request.get_json(force=True)
        username = data.get("username")
        password = data.get("password")

        users = users_ref.get() or {}
        matched_user = None
        for user in users.values():
            if user.get("username") == username and user.get("password") == password:
                matched_user = user
                break

        if not matched_user:
            return jsonify({"success": False, "message": "Invalid username or password"})

        admins = school_admin_ref.get() or {}
        for admin in admins.values():
            if admin.get("userId") == matched_user.get("userId"):
                return jsonify({
                    "success": True,
                    "message": "Login success",
                    "adminId": admin.get("adminId"),
                    "userId": matched_user.get("userId"),
                    "name": matched_user.get("name"),
                    "username": matched_user.get("username"),
                    "profileImage": matched_user.get("profileImage", "")
                })

        return jsonify({"success": False, "message": "Not registered as admin"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ---------------- CREATE POST ---------------- #
@app.route("/api/create_post", methods=["POST"])
def create_post():
    try:
        data = request.form
        text = data.get("message", "")
        adminId = data.get("adminId")  # This is userId from frontend
        media_file = request.files.get("post_media")

        if not adminId:
            return jsonify({"success": False, "message": "Admin not logged in"})

        post_url = ""
        if media_file:
            post_url = upload_file_to_firebase(media_file, folder="posts")

        post_ref = posts_ref.push()
        time_now = datetime.utcnow().isoformat()
        
        # Find admin by userId
        admins = school_admin_ref.get() or {}
        admin_user_id = adminId  # adminId is userId
        admin_key = None
        for key, admin in admins.items():
            if admin.get("userId") == adminId:
                admin_key = key
                break
        
        post_ref.set({
            "postId": post_ref.key,
            "message": text,
            "postUrl": post_url,
            "adminId": adminId,  # Store userId as adminId
            "time": time_now,
            "likeCount": 0,
            "likes": {},
            "seenBy": {
                admin_user_id: True
            }
        })

        return jsonify({"success": True, "message": "Post created successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---------------- GET ALL POSTS ---------------- #
@app.route("/api/get_posts", methods=["GET"])
def get_posts():
    all_posts = posts_ref.get() or {}
    post_list = []

    for key, post in all_posts.items():
        # Get admin's userId from post
        admin_user_id = None
        admins = school_admin_ref.get() or {}
        for admin_id, admin_data in admins.items():
            if admin_data.get("adminId") == post.get("adminId"):
                admin_user_id = admin_data.get("userId")
                break
        
        # Get user data from Users node using admin's userId
        user_data = users_ref.child(admin_user_id).get() or {} if admin_user_id else {}
        
        post_list.append({
            "postId": key,
            "message": post.get("message"),
            "postUrl": post.get("postUrl"),
            "adminId": post.get("adminId"),
            "adminName": user_data.get("name", "Admin"),
            "adminProfile": user_data.get("profileImage", "/default-profile.png"),
            "time": post.get("time"),
            "likes": post.get("likes", {}),
            "likeCount": post.get("likeCount", 0),
            "seenBy": post.get("seenBy", {})   # 🔥 THIS LINE
        })



    post_list.reverse()
    return jsonify(post_list)


@app.route("/api/get_all_posts", methods=["GET"])
def get_all_posts():
    all_posts = posts_ref.get() or {}
    post_list = []

    for key, post in all_posts.items():
        post_list.append({
            "postId": key,
            "message": post.get("message"),
            "postUrl": post.get("postUrl"),
            "adminId": post.get("adminId"),
            "time": post.get("time"),
            "likeCount": post.get("likeCount", 0)
        })

    post_list.reverse()
    return jsonify(post_list)



@app.route("/api/mark_post_seen", methods=["POST"])
def mark_post_seen():
    try:
        data = request.get_json(force=True)
        postId = data.get("postId")
        userId = data.get("userId")

        if not postId or not userId:
            return jsonify({"success": False, "message": "Invalid data"}), 400

        post_ref = posts_ref.child(postId)
        post_data = post_ref.get()

        if not post_data:
            return jsonify({"success": False, "message": "Post not found"}), 404

        seen_by = post_data.get("seenBy", {})
        seen_by[userId] = True

        post_ref.update({"seenBy": seen_by})

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500



# ---------------- ADMIN PROFILE ---------------- #
@app.route("/api/admin/<adminId>", methods=["GET"])
def fetch_admin_profile(adminId):
    admin_data = school_admin_ref.child(adminId).get()
    if not admin_data:
        return jsonify({"success": False, "message": "Admin not found"}), 404
    user_data = users_ref.child(admin_data["userId"]).get() or {}
    profile = {
        "adminId": adminId,
        "name": user_data.get("name"),
        "username": user_data.get("username"),
        "profileImage": user_data.get("profileImage", "/default-profile.png")
    }
    return jsonify({"success": True, "admin": profile})

# ---------------- GET MY POSTS ---------------- #
@app.route("/api/get_my_posts/<adminId>", methods=["GET"])
def get_my_posts(adminId):
    all_posts = posts_ref.get() or {}
    my_posts = []

    # Find the admin record to get both userId and adminId
    admins = school_admin_ref.get() or {}
    admin_key = None
    for key, admin in admins.items():
        if admin.get("userId") == adminId:
            admin_key = key
            break

    # Filter posts by userId or adminId
    for key, post in all_posts.items():
        post_admin_id = post.get("adminId")
        if post_admin_id and (str(post_admin_id) == str(adminId) or (admin_key and str(post_admin_id) == str(admin_key))):
            my_posts.append({
                "postId": key,
                "message": post.get("message") or post.get("content") or "",
                "postUrl": post.get("postUrl") or post.get("mediaUrl") or None,
                "time": post.get("time") or post.get("createdAt") or datetime.utcnow().isoformat(),
                "edited": post.get("edited", False),
                "likeCount": post.get("likeCount", 0),
                "likes": post.get("likes", {}),
                "adminId": post_admin_id
            })

    # Sort posts by time descending
    def parse_time(t):
        try:
            return datetime.fromisoformat(t)
        except:
            # Fallback for old time formats
            try:
                return datetime.strptime(t, "%I:%M %p, %b %d %Y")
            except:
                return datetime.min

    my_posts.sort(key=lambda x: parse_time(x["time"]), reverse=True)

    return jsonify(my_posts)

# ---------------- GET POST NOTIFICATIONS ---------------- #
@app.route("/api/get_post_notifications/<adminId>", methods=["GET"])
def get_post_notifications(adminId):
    try:
        all_posts = posts_ref.get() or {}
        notifications = []

        for key, post in all_posts.items():
            seen_by = post.get("seenBy", {})
            # Only include posts the admin has NOT seen
            if not seen_by.get(adminId):
                # Fetch the admin/user who created this post
                user_data = users_ref.child(post.get("adminId")).get() or {}
                notifications.append({
                    "postId": key,
                    "message": post.get("message"),
                    "postUrl": post.get("postUrl"),
                    "adminId": post.get("adminId"),
                    "adminName": user_data.get("name", "Admin"),  # Admin name
                    "adminProfile": user_data.get("profileImage", "/default-profile.png"),  # Admin profile image
                    "time": post.get("time"),
                })

        # Sort newest first
        notifications.sort(key=lambda x: x['time'], reverse=True)
        return jsonify(notifications)
    
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/mark_post_notification_read", methods=["POST"])
def mark_post_notification_read():
    data = request.get_json()
    notification_id = data.get("notificationId")
    
    # your logic here...
    
    return jsonify({"success": True}), 200  # 🔹 must return 200


# ---------------- EDIT POST ---------------- #
@app.route("/api/edit_post/<postId>", methods=["POST"])
def edit_post(postId):
    postId = str(postId)  # ✅ Firebase keys are strings

    data = request.get_json(silent=True) or {}

    adminId = data.get("adminId")
    new_text = data.get("postText") or data.get("message")

    if not adminId:
        return jsonify({"success": False, "message": "adminId missing"}), 400

    if not new_text:
        return jsonify({"success": False, "message": "Empty message"}), 400

    post_ref = posts_ref.child(postId)
    post_data = post_ref.get()

    if not post_data:
        return jsonify({"success": False, "message": "Post not found"}), 404

    if str(post_data.get("adminId")) != str(adminId):
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    post_ref.update({
        "message": new_text,
        "updatedAt": datetime.now().strftime("%I:%M %p, %b %d %Y"),
        "edited": True
    })

    return jsonify({"success": True, "message": "Post updated"})


# ---------------- DELETE POST ---------------- #
@app.route("/api/delete_post/<postId>", methods=["DELETE"])
def delete_post(postId):
    postId = str(postId)  # ✅ Firebase key

    # ✅ READ FROM QUERY PARAMS
    adminId = request.args.get("adminId")

    if not adminId:
        return jsonify({"success": False, 
                         
                         "message": "adminId missing"}), 400

    post_ref = posts_ref.child(postId)
    post_data = post_ref.get()

    if not post_data:
        return jsonify({"success": False, "message": "Post not found"}), 404

    if str(post_data.get("adminId")) != str(adminId):
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    post_ref.delete()

    return jsonify({"success": True, "message": "Post deleted"})


# ---------------- LIKE POST ---------------- #
@app.route("/api/like_post", methods=["POST"])
def like_post():
    try:
        data = request.get_json(force=True)
        postId = data.get("postId")
        adminId = data.get("adminId")
        if not postId or not adminId:
            return jsonify({"success": False, "message": "Invalid data"})

        post_ref = posts_ref.child(postId)
        likes_ref = post_ref.child("likes")
        current_like = likes_ref.child(adminId).get()

        if current_like:
            likes_ref.child(adminId).delete()
        else:
            likes_ref.child(adminId).set(True)

        likes = likes_ref.get() or {}
        post_ref.update({"likeCount": len(likes)})

        return jsonify({"success": True, "likeCount": len(likes), "liked": not current_like})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---------------- CHAT ENDPOINTS ---------------- #

# Send a message
@app.route("/api/send_message", methods=["POST"])
def send_message():
    try:
        data = request.get_json(force=True)
        senderId = data.get("senderId")
        receiverId = data.get("receiverId")
        message = data.get("message")

        if not senderId or not receiverId or not message:
            return jsonify({"success": False, "message": "Invalid data"}), 400

        msg_ref = chats_ref.push()
        msg_ref.set({
            "messageId": msg_ref.key,
            "senderId": senderId,
            "receiverId": receiverId,
            "message": message,
            "time": datetime.now().isoformat(),
            "read": False
        })
        return jsonify({"success": True, "message": "Message sent"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# Get chat between two users
@app.route("/api/chat/<adminId>/<userId>", methods=["GET"])
def get_chat(adminId, userId):
    all_msgs = chats_ref.get() or {}
    chat = [msg for key, msg in all_msgs.items()
            if (msg.get("senderId") in [adminId, userId]) and
               (msg.get("receiverId") in [adminId, userId])]
    chat_sorted = sorted(chat, key=lambda x: x['time'])
    return jsonify(chat_sorted)

# Mark messages as read
@app.route("/api/mark_messages_read", methods=["POST"])
def mark_messages_read():
    data = request.get_json(force=True)
    adminId = data.get("adminId")
    senderId = data.get("senderId")
    all_msgs = chats_ref.get() or {}

    for key, msg in all_msgs.items():
        if msg.get("receiverId") == adminId and msg.get("senderId") == senderId:
            chats_ref.child(key).update({"read": True})

    return jsonify({"success": True})

# Get unread messages for admin
@app.route("/api/unread_messages/<adminId>", methods=["GET"])
def get_unread_messages(adminId):
    all_msgs = chats_ref.get() or {}
    unread_msgs = [msg for key, msg in all_msgs.items()
                   if msg.get("receiverId") == adminId and not msg.get("read", False)]
    return jsonify({"count": len(unread_msgs), "messages": unread_msgs})


# ---------------- FRONTEND (VITE BUILD) ---------------- #
FRONTEND_DIST = os.environ.get(
    "FRONTEND_DIST",
    os.path.join(os.path.dirname(__file__), "frontend", "school-admin", "dist"),
)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    # API routes are handled above. This is a SPA fallback for React Router.
    if not os.path.isdir(FRONTEND_DIST):
        return (
            jsonify({
                "success": False,
                "message": "Frontend not built. Build Vite and set FRONTEND_DIST.",
            }),
            404,
        )

    asset_path = os.path.join(FRONTEND_DIST, path)
    if path and os.path.exists(asset_path) and os.path.isfile(asset_path):
        return send_from_directory(FRONTEND_DIST, path)
    return send_from_directory(FRONTEND_DIST, "index.html")





# ---------------- RUN ---------------- #
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)

