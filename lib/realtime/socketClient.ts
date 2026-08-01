import { io, type Socket } from "socket.io-client";

export function connectCampaignSocket(): Socket {
  return io({
    path: "/api/socket",
    withCredentials: true,
  });
}
