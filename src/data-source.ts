import 'reflect-metadata';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USERNAME ?? 'finledger',
  password: process.env.DATABASE_PASSWORD ?? 'finledger',
  database: process.env.DATABASE_NAME ?? 'finledger',
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
});
