import { fetchApi } from './client';
import type { User, CreateUserRequest, UpdateUserRoleRequest } from '../types';

export const usersApi = {
  /**
   * List all users in the current organization (admin only)
   */
  listUsers: async (): Promise<User[]> => {
    const data = await fetchApi<{ users: User[]; total: number }>('/users');
    return data.users || [];
  },

  /**
   * Create a new user in the current organization (admin only)
   */
  createUser: async (userData: CreateUserRequest): Promise<User> => {
    return fetchApi<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  /**
   * Update a user's role (admin only)
   */
  updateUserRole: async (userId: string, role: UpdateUserRoleRequest): Promise<User> => {
    return fetchApi<User>(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify(role),
    });
  },

  /**
   * Delete a user (admin only)
   */
  deleteUser: async (userId: string): Promise<void> => {
    await fetchApi(`/users/${userId}`, {
      method: 'DELETE',
    });
  },
};
