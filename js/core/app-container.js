/**
 * Dependency Injection Container
 * Modular refactoring - Inversion of Control (IoC)
 *
 * Based on Service Locator pattern, implements singleton management and automatic dependency resolution
 *
 * Design principles:
 * - Single Responsibility: Only responsible for service registration and resolution
 * - Dependency Inversion: High-level modules don't depend on low-level modules, both depend on abstractions
 * - Open/Closed: Open for extension, closed for modification
 *
 * @module AppContainer
 * @author Ziming Wang & Claude
 * @date 2025-11-04
 */

/**
 * Service factory function type
 * @callback ServiceFactory
 * @param {AppContainer} container - Container instance for dependency retrieval
 * @returns {*} Service instance
 */

/**
 * Service configuration type
 * @typedef {Object} ServiceConfig
 * @property {ServiceFactory} factory - Service factory function
 * @property {*} instance - Service instance (lazy-loaded, created on first get)
 * @property {boolean} singleton - Whether singleton (default true)
 * @property {string[]} dependencies - Dependency list (for circular dependency detection)
 */

/**
 * Application Container - Dependency Injection Core
 *
 * Features:
 * 1. Service registration (register)
 * 2. Service retrieval (get)
 * 3. Singleton management (automatic)
 * 4. Circular dependency detection
 * 5. Lifecycle management
 *
 * @example
 * const container = new AppContainer();
 *
 * // Register services
 * container.register('logger', () => new Logger('App'));
 * container.register('config', () => configManager);
 * container.register('audioIO', (c) => new AudioIO(c.get('config'), c.get('logger')));
 *
 * // Get service (auto-create and cache)
 * const audioIO = container.get('audioIO');
 */
export class AppContainer {
  /**
   * Create container instance
   */
  constructor() {
    /**
     * Service registry
     * @type {Map<string, ServiceConfig>}
     */
    this.services = new Map();

    /**
     * Services being created (for circular dependency detection)
     * @type {Set<string>}
     */
    this.creating = new Set();

    /**
     * Debug mode
     * @type {boolean}
     */
    this.debug = false;
  }

  /**
   * Register service
   *
   * @param {string} name - Service name (unique identifier)
   * @param {ServiceFactory} factory - Service factory function
   * @param {Object} options - Options
   * @param {boolean} [options.singleton=true] - Whether singleton
   * @param {string[]} [options.dependencies=[]] - Explicitly declared dependency list
   * @throws {Error} If service name already exists
   *
   * @example
   * container.register('logger', () => new Logger('App'));
   * container.register('audioIO', (c) => new AudioIO(c.get('logger')), {
   *   singleton: true,
   *   dependencies: ['logger']
   * });
   */
  register(name, factory, options = {}) {
    if (this.services.has(name)) {
      throw new Error(`[AppContainer] Service "${name}" already exists, cannot re-register`);
    }

    if (typeof factory !== 'function') {
      throw new TypeError(`[AppContainer] 服务 "${name}" 的工厂必须是函数`);
    }

    const config = {
      factory,
      instance: null,
      singleton: options.singleton !== false, // 默认单例
      dependencies: options.dependencies || []
    };

    this.services.set(name, config);

    if (this.debug) {
      console.log(`[AppContainer]  注册服务: ${name}`, {
        singleton: config.singleton,
        dependencies: config.dependencies
      });
    }
  }

  /**
   * 获取服务实例
   *
   * - 首次获取: 调用工厂函数创建实例
   * - 再次获取: 返回缓存的实例 (单例模式)
   * - 自动解析依赖
   * - 检测循环依赖
   *
   * @param {string} name - 服务名称
   * @returns {*} 服务实例
   * @throws {Error} 如果服务未注册或存在循环依赖
   *
   * @example
   * const logger = container.get('logger');
   * const audioIO = container.get('audioIO'); // 自动注入 logger
   */
  get(name) {
    const config = this.services.get(name);

    if (!config) {
      throw new Error(
        `[AppContainer] 服务 "${name}" 未注册\n` +
        `可用服务: ${Array.from(this.services.keys()).join(', ')}`
      );
    }

    // 返回已创建的单例
    if (config.singleton && config.instance !== null) {
      return config.instance;
    }

    // 循环依赖检测
    if (this.creating.has(name)) {
      const chain = Array.from(this.creating).join(' → ') + ` → ${name}`;
      throw new Error(
        `[AppContainer] 检测到循环依赖:\n${chain}\n` +
        `请检查服务的构造函数,避免相互依赖`
      );
    }

    // 标记正在创建
    this.creating.add(name);

    try {
      if (this.debug) {
        console.log(`[AppContainer] 🔨 创建服务: ${name}`);
      }

      // 调用工厂函数创建实例
      const instance = config.factory(this);

      // 缓存单例
      if (config.singleton) {
        config.instance = instance;
      }

      if (this.debug) {
        console.log(`[AppContainer]  服务已创建: ${name}`);
      }

      return instance;
    } catch (error) {
      console.error(`[AppContainer]  创建服务失败: ${name}`, error);
      throw error;
    } finally {
      // 移除创建标记
      this.creating.delete(name);
    }
  }

  /**
   * 检查服务是否已注册
   *
   * @param {string} name - 服务名称
   * @returns {boolean} 是否已注册
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * 获取所有已注册的服务名称
   *
   * @returns {string[]} 服务名称列表
   */
  getServiceNames() {
    return Array.from(this.services.keys());
  }

  /**
   * 清空容器 (主要用于测试)
   *
   * @param {string} [name] - 可选,只清空指定服务
   */
  clear(name) {
    if (name) {
      this.services.delete(name);
      if (this.debug) {
        console.log(`[AppContainer] 🗑  清空服务: ${name}`);
      }
    } else {
      this.services.clear();
      this.creating.clear();
      if (this.debug) {
        console.log('[AppContainer] 🗑  清空所有服务');
      }
    }
  }

  /**
   * 启用/禁用调试模式
   *
   * @param {boolean} enabled - 是否启用
   */
  setDebug(enabled) {
    this.debug = enabled;
    console.log(`[AppContainer] 调试模式: ${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 获取容器状态 (用于调试)
   *
   * @returns {Object} 容器状态
   */
  getStatus() {
    const services = Array.from(this.services.entries()).map(([name, config]) => ({
      name,
      singleton: config.singleton,
      created: config.instance !== null,
      dependencies: config.dependencies
    }));

    return {
      totalServices: this.services.size,
      createdServices: services.filter(s => s.created).length,
      services
    };
  }

  /**
   * 打印容器状态 (调试用)
   */
  printStatus() {
    const status = this.getStatus();
    console.log('[AppContainer] 容器状态:');
    console.log(`  总服务数: ${status.totalServices}`);
    console.log(`  已创建: ${status.createdServices}`);
    console.table(status.services);
  }
}

/**
 * 创建全局容器实例 (单例)
 *
 * 注意: 这是一个全局单例,整个应用共享
 * 如果需要测试隔离,可以在测试中创建独立的容器实例
 */
let globalContainer = null;

/**
 * 获取全局容器实例
 *
 * @returns {AppContainer} 全局容器
 *
 * @example
 * import { getGlobalContainer } from './core/app-container.js';
 *
 * const container = getGlobalContainer();
 * const logger = container.get('logger');
 */
export function getGlobalContainer() {
  if (!globalContainer) {
    globalContainer = new AppContainer();
  }
  return globalContainer;
}

/**
 * 重置全局容器 (主要用于测试)
 */
export function resetGlobalContainer() {
  globalContainer = null;
}

// 默认导出容器类
export default AppContainer;
