import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable(
  "rooms",
  {
    code: text("code").primaryKey(),
    state: text("state").notNull(),
    revision: integer("revision").notNull().default(0),
    owner: text("owner").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("idx_rooms_owner_created").on(t.owner, t.createdAt)],
);

export const roomChat = sqliteTable("room_chat", {
  code: text("code").primaryKey(),
  history: text("history").notNull(),
  revision: integer("revision").notNull().default(0),
});
