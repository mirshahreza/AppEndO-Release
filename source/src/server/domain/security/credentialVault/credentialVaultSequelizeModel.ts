import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';
import { getControlPlaneSequelize, controlPlaneSequelizeSyncOptions } from '../../../db/controlPlaneSequelize';

export type CredentialVaultSecretRow = {
  id: string;
  ownerType: string;
  ownerId: string;
  purpose: string;
  keyVersion: number;
  iv: string;
  authTag: string;
  ciphertext: string;
  createdAt: Date | null;
  createdBy: number | null;
  updatedAt: Date | null;
  updatedBy: number | null;
  rotatedAt: Date | null;
};

export type CredentialVaultSecretModel =
  Model<CredentialVaultSecretRow, Partial<CredentialVaultSecretRow>> & CredentialVaultSecretRow;

let cachedModel: ModelStatic<CredentialVaultSecretModel> | null = null;

export const getCredentialVaultModel = (
  sequelize: Sequelize = getControlPlaneSequelize(),
): ModelStatic<CredentialVaultSecretModel> => {
  if (cachedModel && cachedModel.sequelize === sequelize) {
    return cachedModel;
  }
  cachedModel = sequelize.define<CredentialVaultSecretModel>(
    'BaseCredentialVaultSecret',
    {
      id: { type: DataTypes.STRING(36), primaryKey: true },
      ownerType: { type: DataTypes.STRING(64), allowNull: false, field: 'owner_type' },
      ownerId: { type: DataTypes.STRING(128), allowNull: false, field: 'owner_id' },
      purpose: { type: DataTypes.STRING(64), allowNull: false },
      keyVersion: { type: DataTypes.INTEGER, allowNull: false, field: 'key_version' },
      iv: { type: DataTypes.TEXT, allowNull: false },
      authTag: { type: DataTypes.TEXT, allowNull: false, field: 'auth_tag' },
      ciphertext: { type: DataTypes.TEXT('long'), allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
      createdBy: { type: DataTypes.BIGINT, allowNull: true, field: 'created_by' },
      updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
      updatedBy: { type: DataTypes.BIGINT, allowNull: true, field: 'updated_by' },
      rotatedAt: { type: DataTypes.DATE, allowNull: true, field: 'rotated_at' },
    },
    {
      tableName: 'base_credential_vault_secrets',
      timestamps: false,
      indexes: [
        {
          unique: true,
          name: 'uq_cred_vault_owner_purpose',
          fields: ['owner_type', 'owner_id', 'purpose'],
        },
        {
          name: 'ix_cred_vault_owner',
          fields: ['owner_type', 'owner_id'],
        },
      ],
    },
  );
  return cachedModel;
};

export const resetCredentialVaultModelCacheForTests = (): void => {
  cachedModel = null;
};

export const ensureCredentialVaultTable = async (
  sequelize: Sequelize = getControlPlaneSequelize(),
): Promise<void> => {
  const model = getCredentialVaultModel(sequelize);
  await model.sync(controlPlaneSequelizeSyncOptions(sequelize));
};
