/**
 * DEMO-сессии для прототипа. В production пользователь и его роль/школа приходят
 * из IdP (OIDC) и таблицы user_roles на backend; frontend их не выбирает.
 */

import type { Role, User } from "../domain/user";
import { getMockIndex } from "../data/mock/mockDataset";

export function demoUsers(): Record<Role, User> {
  const schools = getMockIndex().ds.schools;
  return {
    education_head: {
      id: "u-head",
      name: "А. Королёва",
      role: "education_head",
    },
    analyst: { id: "u-analyst", name: "И. Смирнов", role: "analyst" },
    school_director: {
      id: "u-director",
      name: "Е. Павлова",
      role: "school_director",
      schoolId: schools[0].id,
    },
  };
}
