import axios from "axios";
import { BACKEND_BASE } from "./config";

const API_BASE = `${BACKEND_BASE}/api`;

// Return the axios response so callers can use `res.data`
export const getAdminProfile = (adminId) =>
  axios.get(`${API_BASE}/admin/${encodeURIComponent(adminId)}`);

export const getAllPosts = () => axios.get(`${API_BASE}/get_all_posts`);

