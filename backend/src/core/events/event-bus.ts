import { EventEmitter } from 'node:events';

/**
 * Typed event map for the whole monolith.
 * Features extend this map by declaration-merging — DO NOT cast/any here.
 */
export interface AppEventMap {
  'iam.user.logged-in': { userId: string; sessionId: string; ip?: string; userAgent?: string };
  'iam.user.password-changed': { userId: string };
  'iam.user.locked': { userId: string; reason: string };
  'iam.session.revoked': { userId: string; sessionId: string };
  'iam.session.reuse-detected': { userId: string };
  'employee.granted-login': {
    userId: string;
    employeeId: string;
    username: string;
    tempPassword: string;
    sendTo?: string;
  };
  'employee.created': { employeeId: string; createdBy: string };
  'employee.terminated': { employeeId: string; terminatedBy: string };
  // Reserved for future features (payroll, ...) — extend later.
}

class TypedEventBus {
  private readonly emitter = new EventEmitter({ captureRejections: true });

  emit<K extends keyof AppEventMap>(event: K, payload: AppEventMap[K]): boolean {
    return this.emitter.emit(event, payload);
  }

  on<K extends keyof AppEventMap>(
    event: K,
    listener: (payload: AppEventMap[K]) => void | Promise<void>,
  ): void {
    this.emitter.on(event, listener);
  }

  off<K extends keyof AppEventMap>(
    event: K,
    listener: (payload: AppEventMap[K]) => void,
  ): void {
    this.emitter.off(event, listener);
  }
}

export const eventBus = new TypedEventBus();
