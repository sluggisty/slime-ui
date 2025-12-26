import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Edit2, Trash2, Shield, UserCheck, Eye, AlertCircle } from 'lucide-react'
import { usersApi } from '../api/users'
import type { User, CreateUserRequest, UpdateUserRoleRequest } from '../types'
import { Modal } from '../components/Modal'
import styles from './UserAccess.module.css'

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

const roleIcons: Record<string, typeof Shield> = {
  admin: Shield,
  editor: UserCheck,
  viewer: Eye,
}

export default function UserAccess() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [error, setError] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.listUsers,
  })

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { authApi } = await import('../api/auth')
      return authApi.getMe()
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
  })

  const createUserMutation = useMutation({
    mutationFn: usersApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreateModal(false)
      setError('')
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UpdateUserRoleRequest }) =>
      usersApi.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowEditModal(false)
      setSelectedUser(null)
      setError('')
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: usersApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowDeleteModal(false)
      setSelectedUser(null)
      setError('')
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleCreate = (userData: CreateUserRequest) => {
    createUserMutation.mutate(userData)
  }

  const handleUpdateRole = (userId: string, role: 'admin' | 'editor' | 'viewer') => {
    updateRoleMutation.mutate({ userId, role: { role } })
  }

  const handleDelete = (userId: string) => {
    deleteUserMutation.mutate(userId)
  }

  const openEditModal = (user: User) => {
    setSelectedUser(user)
    setShowEditModal(true)
    setError('')
  }

  const openDeleteModal = (user: User) => {
    setSelectedUser(user)
    setShowDeleteModal(true)
    setError('')
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading users...</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <Users size={24} />
            <h1>User Access</h1>
          </div>
          <button
            className={styles.createButton}
            onClick={() => {
              setShowCreateModal(true)
              setError('')
            }}
          >
            <Plus size={18} />
            Create User
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const RoleIcon = roleIcons[user.role] || UserCheck
                  const isCurrentUser = currentUser?.id === user.id

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className={styles.userCell}>
                          <span className={styles.username}>{user.username}</span>
                          {isCurrentUser && (
                            <span className={styles.currentUserBadge}>(You)</span>
                          )}
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <div className={styles.roleCell}>
                          <RoleIcon size={16} />
                          <span>{roleLabels[user.role] || user.role}</span>
                        </div>
                      </td>
                      <td>
                        <span className={user.is_active ? styles.active : styles.inactive}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={styles.actionButton}
                            onClick={() => openEditModal(user)}
                            disabled={isCurrentUser}
                            title={isCurrentUser ? 'Cannot edit your own role' : 'Edit role'}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className={styles.actionButton}
                            onClick={() => openDeleteModal(user)}
                            disabled={isCurrentUser}
                            title={isCurrentUser ? 'Cannot delete yourself' : 'Delete user'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setError('')
        }}
        onCreate={handleCreate}
        isLoading={createUserMutation.isPending}
      />

      {/* Edit Role Modal */}
      {selectedUser && (
        <EditRoleModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedUser(null)
            setError('')
          }}
          user={selectedUser}
          onUpdate={(role) => handleUpdateRole(selectedUser.id, role)}
          isLoading={updateRoleMutation.isPending}
        />
      )}

      {/* Delete User Modal */}
      {selectedUser && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setSelectedUser(null)
            setError('')
          }}
          title="Delete User"
          onConfirm={() => handleDelete(selectedUser.id)}
          confirmText="Delete"
          cancelText="Cancel"
          isConfirming={deleteUserMutation.isPending}
          variant="danger"
        >
          <p>
            Are you sure you want to delete user <strong>{selectedUser.username}</strong>?
            This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}

// Create User Modal Component
function CreateUserModal({
  isOpen,
  onClose,
  onCreate,
  isLoading,
}: {
  isOpen: boolean
  onClose: () => void
  onCreate: (userData: CreateUserRequest) => void
  isLoading: boolean
}) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('viewer')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreate({ username, email, password, role })
    // Reset form on success (handled by parent)
    if (!isLoading) {
      setUsername('')
      setEmail('')
      setPassword('')
      setRole('viewer')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create User"
      onConfirm={handleSubmit}
      confirmText="Create"
      cancelText="Cancel"
      isConfirming={isLoading}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="create-username">Username</label>
          <input
            id="create-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={50}
            disabled={isLoading}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="create-email">Email</label>
          <input
            id="create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="create-password">Password</label>
          <input
            id="create-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={isLoading}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="create-role">Role</label>
          <select
            id="create-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'editor' | 'viewer')}
            required
            disabled={isLoading}
            className={styles.select}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </form>
    </Modal>
  )
}

// Edit Role Modal Component
function EditRoleModal({
  isOpen,
  onClose,
  user,
  onUpdate,
  isLoading,
}: {
  isOpen: boolean
  onClose: () => void
  user: User
  onUpdate: (role: 'admin' | 'editor' | 'viewer') => void
  isLoading: boolean
}) {
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>(user.role as 'admin' | 'editor' | 'viewer')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate(role)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update User Role"
      onConfirm={handleSubmit}
      confirmText="Update"
      cancelText="Cancel"
      isConfirming={isLoading}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <p className={styles.userInfo}>
          Updating role for: <strong>{user.username}</strong> ({user.email})
        </p>
        <div className={styles.formGroup}>
          <label htmlFor="edit-role">Role</label>
          <select
            id="edit-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'editor' | 'viewer')}
            required
            disabled={isLoading}
            className={styles.select}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </form>
    </Modal>
  )
}

