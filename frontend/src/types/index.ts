export type UserRole = 'admin' | 'facilitator' | 'participant'

export type SelfRegisterRole = 'facilitator' | 'participant'

export interface User {
  id: number
  email: string
  name: string
  role: UserRole
  bio: string
}

export interface FacilitatorProfile {
  id: number
  name: string
  bio: string
  role: UserRole
}

export type WorkshopStatus = 'draft' | 'published' | 'canceled'

export type LocationType = 'online' | 'offline'

export interface Workshop {
  id: number
  title: string
  description: string
  image_url: string
  facilitator_id: number
  facilitator_name: string
  location_type: LocationType
  location: string
  start_at: string
  end_at: string
  capacity: number
  price: number
  cancellation_policy: string
  reserved_count: number
  status: WorkshopStatus
  is_favorited: boolean
  is_reserved: boolean
}

export type WorkshopInput = Pick<
  Workshop,
  | 'title'
  | 'description'
  | 'location_type'
  | 'location'
  | 'start_at'
  | 'end_at'
  | 'capacity'
  | 'price'
  | 'cancellation_policy'
  | 'status'
>

export type ReservationStatus = 'confirmed' | 'canceled'

export interface Reservation {
  id: number
  workshop_id: number
  workshop: Workshop
  user_id: number
  user_name: string
  attendee_name: string
  contact: string
  ticket_count: number
  status: ReservationStatus
  created_at: string
}

export interface ReservationCreate {
  attendee_name: string
  contact: string
  ticket_count: number
}

export type NotificationType = 'cancellation' | 'reminder'

export interface Notification {
  id: number
  workshop_id: number
  workshop_title: string
  type: NotificationType
  message: string
  is_read: boolean
  created_at: string
}
