// lib/marketplace/notifications.ts
import { createSupabaseAdmin } from '../supabase/server'
import { NotificationType } from '../types/marketplace'

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseAdmin()
    
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        read: false,
      })
    
    if (error) throw error
    
    return { success: true }
  } catch (err: unknown) {
    const error = err as Error
    console.error('[Notifications] Failed to create notification:', error)
    return { success: false, error: error.message }
  }
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin()
    
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
    
    return !error
  } catch {
    return false
  }
}