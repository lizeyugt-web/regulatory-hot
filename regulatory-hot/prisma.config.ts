import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    url: "file:./regulatory.db",
  },
  migrate: {
    adapter: "sqlite",
  },
});
