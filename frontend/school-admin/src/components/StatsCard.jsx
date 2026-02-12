import React from "react";

export default function StatsCard({ title, value, icon }) {
  return (
    <div className="card bg-white p-4 shadow-md rounded-lg">
      <div className="flex items-center">
        <div className="text-3xl text-indigo-600 mr-4">{icon}</div>
        <div>
          <div className="text-sm text-gray-500">{title}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}
