export const SUPPLIER_ROLES = [
  "SALES_MAN",
  "OWNER",
  "DISTRIBUTOR",
  "DEALER",
  "WHOLESALER",
  "RETAILER",
  "MANUFACTURER",
  "IMPORTER",
  "REPRESENTATIVE",
] as const;
export type SupplierRole = (typeof SUPPLIER_ROLES)[number];

export type SupplierProfile = {
  id: string;
  email: string | null;
  name: string;
  mobile: string;
  address: string | null;
};

export type Supplier = {
  id: string;
  profile_id: string;
  role: SupplierRole;
  supplies: string[];
  company: string | null;
  is_active: boolean;
  /** Owed from before FMS; decimal string. */
  opening_due: string;
  opening_date: string | null;
  opening_note: string | null;
  created_at: string;
  updated_at: string;
  profile: SupplierProfile;
};
