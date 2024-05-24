import { createContext } from "react";

export type Profile = {
  avatar: string;
  permission: boolean;
  name: string
}

export const ProfileContext = createContext<Profile | undefined>(undefined);
