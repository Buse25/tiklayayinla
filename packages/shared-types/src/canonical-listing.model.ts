/** Sistemdeki tüm ilanlar için portal-bağımsız tek doğruluk kaynağı. */
export interface CanonicalListing {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  price: number;
  currency: Currency;
  location: ListingLocation;
  rooms?: string;
  areaSqm: number;
  listingType: ListingType;
  propertyType: PropertyType;
  images: ListingImage[];
  contact: ContactInfo;
  owner: ListingOwner;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}

export type Currency = 'TRY' | 'USD' | 'EUR' | 'GBP';
export type ListingType = 'SALE' | 'RENT';
export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type PropertyType =
  | 'APARTMENT' | 'HOUSE' | 'VILLA' | 'LAND' | 'COMMERCIAL' | 'OFFICE' | 'BUILDING' | 'OTHER';

export interface ListingLocation {
  address: string;
  district: string;
  city: string;
  country: string;
  postalCode?: string;
  coordinates?: { latitude: number; longitude: number };
}

export interface ListingImage {
  id: string;
  url: string;
  sortOrder: number;
  altText?: string;
}

export interface ContactInfo {
  name: string;
  phone: string;
  email?: string;
}

export interface ListingOwner {
  id: string;
  type: 'AGENCY' | 'AGENT' | 'INDIVIDUAL';
  displayName: string;
}
