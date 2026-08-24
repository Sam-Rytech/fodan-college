import { describe, it, expect } from 'vitest';
import { hasPermission, classScopeFilter } from '../rbac';
import { PERMISSIONS, ROLES } from '../../constants';
import type { AuthUser } from '../types';

describe('RBAC - hasPermission', () => {
  it('should grant everything to SUPER_ADMIN', () => {
    const user = { role: ROLES.SUPER_ADMIN, permissions: [] } as unknown as AuthUser;
    expect(hasPermission(user, PERMISSIONS.MANAGE_STUDENTS)).toBe(true);
  });

  it('should grant permission to MINI_ADMIN if explicitly set', () => {
    const user = { 
      role: ROLES.MINI_ADMIN, 
      permissions: [PERMISSIONS.MANAGE_STUDENTS] 
    } as unknown as AuthUser;
    expect(hasPermission(user, PERMISSIONS.MANAGE_STUDENTS)).toBe(true);
  });

  it('should deny permission to MINI_ADMIN if not set', () => {
    const user = { 
      role: ROLES.MINI_ADMIN, 
      permissions: [] 
    } as unknown as AuthUser;
    expect(hasPermission(user, PERMISSIONS.MANAGE_STUDENTS)).toBe(false);
  });
});

describe('RBAC - classScopeFilter', () => {
  it('should return empty object for SUPER_ADMIN', () => {
    const user = { role: ROLES.SUPER_ADMIN, permissions: [] } as unknown as AuthUser;
    expect(classScopeFilter(user)).toEqual({});
  });

  it('should return allowed classes for MINI_ADMIN', () => {
    const user = { 
      role: ROLES.MINI_ADMIN, 
      assignedClassIds: ['class1'] 
    } as unknown as AuthUser;
    expect(classScopeFilter(user)).toEqual({ classId: { in: ['class1'] } });
  });
});
