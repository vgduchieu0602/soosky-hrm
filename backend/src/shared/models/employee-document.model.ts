import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'employeeDocument';
const COLLECTION_NAME = 'employeeDocuments';

export const DOCUMENT_TYPE = [
  'id_card',
  'passport',
  'degree',
  'certificate',
  'visa',
  'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPE)[number];

export interface IEmployeeDocument {
  employeeId: Types.ObjectId;
  documentType: DocumentType;
  documentNumber: string;
  fileUrl?: string;
  issuedDate?: Date;
  expiryDate?: Date | null;
  issuedBy?: string;
  created_at?: Date;
  updated_at?: Date;
}

export type EmployeeDocumentDoc = HydratedDocument<IEmployeeDocument>;

const employeeDocumentSchema = new Schema<IEmployeeDocument>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    documentType: { type: String, enum: DOCUMENT_TYPE, required: true },
    documentNumber: { type: String, required: true, trim: true },
    fileUrl: { type: String },
    issuedDate: { type: Date },
    expiryDate: { type: Date, default: null },
    issuedBy: { type: String, trim: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const EmployeeDocumentModel = mongoose.model<IEmployeeDocument>(
  DB_NAME,
  employeeDocumentSchema,
);
