import type { SchoolId } from "./common";

export type Role = "education_head" | "school_director" | "analyst";

export const ROLE_LABEL: Record<Role, string> = {
  education_head: "Руководитель системы образования",
  school_director: "Директор школы",
  analyst: "Аналитик",
};

interface UserBase {
  id: string;
  name: string;
}

export type User =
  | (UserBase & {
      role: "education_head" | "analyst";
      schoolId?: undefined;
    })
  | (UserBase & { role: "school_director"; schoolId: SchoolId });

/** Область видимости данных, производная от пользователя. */

export type AccessScope =
  | { kind: "system" }
  | {
      kind: "school";
      schoolId: SchoolId;
    };
