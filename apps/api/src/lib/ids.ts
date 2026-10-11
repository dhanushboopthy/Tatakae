import { ulid } from "ulid";
export const newId = () => ulid();
export const nowIso = () => new Date().toISOString();
