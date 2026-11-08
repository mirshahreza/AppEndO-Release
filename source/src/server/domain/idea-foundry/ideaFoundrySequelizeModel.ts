import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';
import { getControlPlaneSequelize, controlPlaneSequelizeSyncOptions } from '../../db/controlPlaneSequelize';

export type ProductIdeaRow = {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  importance: string;
  scale: string;
  maturity: string;
  targetKind: string;
  packageId: string | null;
  packageTitle: string | null;
  sectionKey: string | null;
  sectionTitle: string | null;
  frontOffice: string | null;
  backOffice: string | null;
  note: string | null;
  decisionMaker: string | null;
  collaborators: string | null;
  teamModels: string | null;
  createdAt: Date | null;
  createdBy: number | null;
  updatedAt: Date | null;
  updatedBy: number | null;
};

export type ProductIdeaModel = Model<ProductIdeaRow, Partial<ProductIdeaRow>> & ProductIdeaRow;

let cachedModel: ModelStatic<ProductIdeaModel> | null = null;

export const getProductIdeaModel = (
  sequelize: Sequelize = getControlPlaneSequelize(),
): ModelStatic<ProductIdeaModel> => {
  if (cachedModel && cachedModel.sequelize === sequelize) {
    return cachedModel;
  }
  cachedModel = sequelize.define<ProductIdeaModel>(
    'BaseProductIdea',
    {
      id: { type: DataTypes.STRING(36), primaryKey: true },
      title: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      icon: { type: DataTypes.STRING(128), allowNull: true },
      importance: { type: DataTypes.STRING(32), allowNull: false },
      scale: { type: DataTypes.STRING(32), allowNull: false },
      maturity: { type: DataTypes.STRING(32), allowNull: false },
      targetKind: { type: DataTypes.STRING(32), allowNull: false, field: 'target_kind' },
      packageId: { type: DataTypes.STRING(128), allowNull: true, field: 'package_id' },
      packageTitle: { type: DataTypes.STRING(255), allowNull: true, field: 'package_title' },
      sectionKey: { type: DataTypes.STRING(128), allowNull: true, field: 'section_key' },
      sectionTitle: { type: DataTypes.STRING(255), allowNull: true, field: 'section_title' },
      frontOffice: { type: DataTypes.TEXT, allowNull: true, field: 'front_office' },
      backOffice: { type: DataTypes.TEXT, allowNull: true, field: 'back_office' },
      note: { type: DataTypes.TEXT, allowNull: true },
      decisionMaker: { type: DataTypes.TEXT, allowNull: true, field: 'decision_maker' },
      collaborators: { type: DataTypes.TEXT, allowNull: true },
      teamModels: { type: DataTypes.TEXT, allowNull: true, field: 'team_models' },
      createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
      createdBy: { type: DataTypes.BIGINT, allowNull: true, field: 'created_by' },
      updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
      updatedBy: { type: DataTypes.BIGINT, allowNull: true, field: 'updated_by' },
    },
    {
      tableName: 'base_product_ideas',
      timestamps: false,
    },
  );
  return cachedModel;
};

export const ensureProductIdeaTable = async (): Promise<void> => {
  const sequelize = getControlPlaneSequelize();
  const model = getProductIdeaModel(sequelize);
  await model.sync(controlPlaneSequelizeSyncOptions(sequelize));
};
