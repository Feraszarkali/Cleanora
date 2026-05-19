
export type CleaningType = 'buroreinigung' | 'praxisreinigung' | 'fensterreinigung' | 'airbnb' | 'restaurant' | 'treppenhaus' | 'bauendreinigung' | 'unterhaltsreinigung' | 'sonstiges';
export type LeadStatus = 'new' | 'verified' | 'reviewed' | 'ready_to_send' | 'sent_to_companies' | 'closed';
export interface Lead { id: string; customer_name: string; customer_email: string; cleaning_type: CleaningType; status: LeadStatus; city: string; created_at: string; ai_score: 'gold' | 'silver' | 'low_quality'; }
export interface Company { id: string; name: string; city: string; services: CleaningType[]; }
