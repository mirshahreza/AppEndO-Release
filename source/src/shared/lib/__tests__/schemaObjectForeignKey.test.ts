import { describe, expect, it } from 'vitest';
import {
  buildAddForeignKeyStatement,
  buildDropForeignKeyStatement,
  canMutatePhysicalForeignKeys,
  suggestForeignKeyConstraintName,
} from '../schemaObjectForeignKey';

describe('schemaObjectForeignKey', () => {
  it('suggests a constraint name', () => {
    expect(suggestForeignKeyConstraintName('orders', 'customer_id')).toBe('fk_orders_customer_id');
  });

  it('builds PostgreSQL ADD / DROP statements', () => {
    expect(buildAddForeignKeyStatement('PostgreSQL', {
      tableName: 'orders',
      columnName: 'customer_id',
      referencedTable: 'customers',
      referencedColumn: 'id',
      constraintName: 'fk_orders_customer_id',
      onDelete: 'CASCADE',
    })).toBe(
      'ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE',
    );

    expect(buildDropForeignKeyStatement('PostgreSQL', {
      tableName: 'orders',
      constraintName: 'fk_orders_customer_id',
    })).toBe('ALTER TABLE "orders" DROP CONSTRAINT "fk_orders_customer_id"');
  });

  it('builds MySQL DROP FOREIGN KEY statements', () => {
    expect(buildDropForeignKeyStatement('MySQL', {
      tableName: 'orders',
      constraintName: 'fk_orders_customer_id',
    })).toBe('ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_customer_id`');
  });

  it('rejects SQLite and altering platform tables, but allows referencing base_*', () => {
    expect(() => buildAddForeignKeyStatement('SQLite', {
      tableName: 'orders',
      columnName: 'customer_id',
      referencedTable: 'customers',
      referencedColumn: 'id',
    })).toThrow(/SQLite/i);

    expect(() => buildAddForeignKeyStatement('PostgreSQL', {
      tableName: 'base_users',
      columnName: 'role_id',
      referencedTable: 'base_roles',
      referencedColumn: 'id',
    })).toThrow(/platform table/i);

    expect(buildAddForeignKeyStatement('PostgreSQL', {
      tableName: 'products',
      columnName: 'category_id',
      referencedTable: 'base_info',
      referencedColumn: 'id',
      constraintName: 'fk_products_category_id',
    })).toBe(
      'ALTER TABLE "products" ADD CONSTRAINT "fk_products_category_id" FOREIGN KEY ("category_id") REFERENCES "base_info" ("id")',
    );
  });

  it('gates UI editability', () => {
    expect(canMutatePhysicalForeignKeys('PostgreSQL', 'TABLE', 'orders')).toBe(true);
    expect(canMutatePhysicalForeignKeys('SQLite', 'TABLE', 'orders')).toBe(false);
    expect(canMutatePhysicalForeignKeys('PostgreSQL', 'VIEW', 'orders_v')).toBe(false);
    expect(canMutatePhysicalForeignKeys('PostgreSQL', 'TABLE', 'base_users')).toBe(false);
  });
});
