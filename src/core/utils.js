/**
 * Utilities Module
 * 
 * General-purpose utility functions for data validation, deep cloning, 
 * object merging, time utilities, and data serialization as specified 
 * in the Agent Neo implementation plan Step 10.
 * 
 * Features:
 * - Data validation and sanitization
 * - Deep object operations (clone, merge, diff)
 * - Time and date utilities
 * - JSON-LD serialization/deserialization
 * - Type checking and conversion
 * - Performance measurement utilities
 */

class Utils {
    constructor() {
        this.version = '1.0.0';
        
        // Common regex patterns
        this.patterns = {
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            url: /^https?:\/\/.+/,
            uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            did: /^did:[a-z0-9]+:[a-zA-Z0-9._%-]*[a-zA-Z0-9._%-]+$/,
            ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
            ipv6: /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i
        };
    }

    // =================
    // Type Checking
    // =================

    /**
     * Check if value is a specific type
     */
    isType(value, type) {
        return typeof value === type;
    }

    /**
     * Check if value is an object (not array or null)
     */
    isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    /**
     * Check if value is a plain object
     */
    isPlainObject(value) {
        return this.isObject(value) && value.constructor === Object;
    }

    /**
     * Check if value is an array
     */
    isArray(value) {
        return Array.isArray(value);
    }

    /**
     * Check if value is a function
     */
    isFunction(value) {
        return typeof value === 'function';
    }

    /**
     * Check if value is a string
     */
    isString(value) {
        return typeof value === 'string';
    }

    /**
     * Check if value is a number
     */
    isNumber(value) {
        return typeof value === 'number' && !isNaN(value);
    }

    /**
     * Check if value is a boolean
     */
    isBoolean(value) {
        return typeof value === 'boolean';
    }

    /**
     * Check if value is null or undefined
     */
    isNullish(value) {
        return value === null || value === undefined;
    }

    /**
     * Check if value is empty (null, undefined, empty string, empty array, empty object)
     */
    isEmpty(value) {
        if (this.isNullish(value)) return true;
        if (this.isString(value)) return value.length === 0;
        if (this.isArray(value)) return value.length === 0;
        if (this.isObject(value)) return Object.keys(value).length === 0;
        return false;
    }

    // =================
    // Data Validation
    // =================

    /**
     * Validate email address
     */
    isValidEmail(email) {
        return this.isString(email) && this.patterns.email.test(email);
    }

    /**
     * Validate URL
     */
    isValidUrl(url) {
        return this.isString(url) && this.patterns.url.test(url);
    }

    /**
     * Validate UUID
     */
    isValidUuid(uuid) {
        return this.isString(uuid) && this.patterns.uuid.test(uuid);
    }

    /**
     * Validate DID (Decentralized Identifier)
     */
    isValidDid(did) {
        return this.isString(did) && this.patterns.did.test(did);
    }

    /**
     * Validate IPv4 address
     */
    isValidIpv4(ip) {
        return this.isString(ip) && this.patterns.ipv4.test(ip);
    }

    /**
     * Validate IPv6 address
     */
    isValidIpv6(ip) {
        return this.isString(ip) && this.patterns.ipv6.test(ip);
    }

    /**
     * Sanitize string (remove HTML tags and dangerous characters)
     */
    sanitizeString(str) {
        if (!this.isString(str)) return '';
        
        return str
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/[<>\"'&]/g, '') // Remove dangerous characters
            .trim();
    }

    /**
     * Validate object against schema
     */
    validateSchema(obj, schema) {
        const errors = [];

        for (const [key, rules] of Object.entries(schema)) {
            const value = obj[key];

            // Required check
            if (rules.required && this.isNullish(value)) {
                errors.push(`${key} is required`);
                continue;
            }

            // Skip further validation if optional and not provided
            if (!rules.required && this.isNullish(value)) {
                continue;
            }

            // Type check
            if (rules.type && !this.validateType(value, rules.type)) {
                errors.push(`${key} must be of type ${rules.type}`);
            }

            // Min/Max checks for numbers
            if (rules.min !== undefined && this.isNumber(value) && value < rules.min) {
                errors.push(`${key} must be at least ${rules.min}`);
            }
            if (rules.max !== undefined && this.isNumber(value) && value > rules.max) {
                errors.push(`${key} must be at most ${rules.max}`);
            }

            // Min/Max length for strings and arrays
            if (rules.minLength !== undefined && (this.isString(value) || this.isArray(value)) && value.length < rules.minLength) {
                errors.push(`${key} must have at least ${rules.minLength} characters/items`);
            }
            if (rules.maxLength !== undefined && (this.isString(value) || this.isArray(value)) && value.length > rules.maxLength) {
                errors.push(`${key} must have at most ${rules.maxLength} characters/items`);
            }

            // Pattern check for strings
            if (rules.pattern && this.isString(value) && !rules.pattern.test(value)) {
                errors.push(`${key} does not match required pattern`);
            }

            // Custom validator
            if (rules.validator && this.isFunction(rules.validator) && !rules.validator(value)) {
                errors.push(`${key} failed custom validation`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate type against type string
     */
    validateType(value, type) {
        switch (type.toLowerCase()) {
            case 'string': return this.isString(value);
            case 'number': return this.isNumber(value);
            case 'boolean': return this.isBoolean(value);
            case 'array': return this.isArray(value);
            case 'object': return this.isObject(value);
            case 'function': return this.isFunction(value);
            default: return true;
        }
    }

    // =================
    // Object Operations
    // =================

    /**
     * Deep clone an object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }

        if (obj instanceof RegExp) {
            return new RegExp(obj);
        }

        if (this.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }

        if (this.isObject(obj)) {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }

        return obj;
    }

    /**
     * Deep merge objects
     */
    deepMerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();

        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }

        return this.deepMerge(target, ...sources);
    }

    /**
     * Deep compare two objects
     */
    deepEqual(obj1, obj2) {
        if (obj1 === obj2) return true;

        if (obj1 == null || obj2 == null) return obj1 === obj2;

        if (typeof obj1 !== typeof obj2) return false;

        if (typeof obj1 !== 'object') return obj1 === obj2;

        if (this.isArray(obj1) && this.isArray(obj2)) {
            if (obj1.length !== obj2.length) return false;
            for (let i = 0; i < obj1.length; i++) {
                if (!this.deepEqual(obj1[i], obj2[i])) return false;
            }
            return true;
        }

        if (this.isArray(obj1) || this.isArray(obj2)) return false;

        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);

        if (keys1.length !== keys2.length) return false;

        for (const key of keys1) {
            if (!keys2.includes(key)) return false;
            if (!this.deepEqual(obj1[key], obj2[key])) return false;
        }

        return true;
    }

    /**
     * Get difference between two objects
     */
    objectDiff(obj1, obj2) {
        const diff = {};

        const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

        for (const key of allKeys) {
            const val1 = obj1[key];
            const val2 = obj2[key];

            if (!this.deepEqual(val1, val2)) {
                if (this.isObject(val1) && this.isObject(val2)) {
                    const nestedDiff = this.objectDiff(val1, val2);
                    if (!this.isEmpty(nestedDiff)) {
                        diff[key] = nestedDiff;
                    }
                } else {
                    diff[key] = { from: val1, to: val2 };
                }
            }
        }

        return diff;
    }

    /**
     * Get nested property value using dot notation
     */
    getNestedProperty(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = obj;

        for (const key of keys) {
            if (current === null || current === undefined || !(key in current)) {
                return defaultValue;
            }
            current = current[key];
        }

        return current;
    }

    /**
     * Set nested property value using dot notation
     */
    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || !this.isObject(current[key])) {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
        return obj;
    }

    // =================
    // Array Operations
    // =================

    /**
     * Remove duplicates from array
     */
    unique(array, keyFn = null) {
        if (!this.isArray(array)) return [];

        if (keyFn) {
            const seen = new Set();
            return array.filter(item => {
                const key = keyFn(item);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }

        return [...new Set(array)];
    }

    /**
     * Chunk array into smaller arrays
     */
    chunk(array, size) {
        if (!this.isArray(array)) return [];
        if (size <= 0) return [array];

        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Flatten nested array
     */
    flatten(array, depth = Infinity) {
        if (!this.isArray(array)) return [];

        return depth > 0 
            ? array.reduce((acc, val) => acc.concat(this.isArray(val) ? this.flatten(val, depth - 1) : val), [])
            : array.slice();
    }

    /**
     * Shuffle array
     */
    shuffle(array) {
        if (!this.isArray(array)) return [];

        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // =================
    // String Operations
    // =================

    /**
     * Capitalize first letter
     */
    capitalize(str) {
        if (!this.isString(str)) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Convert to camelCase
     */
    camelCase(str) {
        if (!this.isString(str)) return '';
        return str
            .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
            .replace(/^[A-Z]/, char => char.toLowerCase());
    }

    /**
     * Convert to kebab-case
     */
    kebabCase(str) {
        if (!this.isString(str)) return '';
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .toLowerCase()
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Convert to snake_case
     */
    snakeCase(str) {
        if (!this.isString(str)) return '';
        return str
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .toLowerCase()
            .replace(/^_+|_+$/g, '');
    }

    /**
     * Truncate string with ellipsis
     */
    truncate(str, length, suffix = '...') {
        if (!this.isString(str)) return '';
        if (str.length <= length) return str;
        return str.slice(0, length - suffix.length) + suffix;
    }

    // =================
    // Time Utilities
    // =================

    /**
     * Format duration in milliseconds to human readable string
     */
    formatDuration(ms) {
        if (!this.isNumber(ms)) return '0ms';

        const units = [
            { label: 'd', value: 24 * 60 * 60 * 1000 },
            { label: 'h', value: 60 * 60 * 1000 },
            { label: 'm', value: 60 * 1000 },
            { label: 's', value: 1000 },
            { label: 'ms', value: 1 }
        ];

        for (const unit of units) {
            if (ms >= unit.value) {
                const value = Math.floor(ms / unit.value);
                const remainder = ms % unit.value;
                
                if (remainder === 0 || unit.label === 'ms') {
                    return `${value}${unit.label}`;
                } else {
                    const nextUnit = units[units.indexOf(unit) + 1];
                    const nextValue = Math.floor(remainder / nextUnit.value);
                    return `${value}${unit.label} ${nextValue}${nextUnit.label}`;
                }
            }
        }

        return '0ms';
    }

    /**
     * Get relative time string (e.g., "2 hours ago")
     */
    getRelativeTime(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return 'just now';
        if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
        if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
        if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;

        return date.toLocaleDateString();
    }

    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // =================
    // Serialization
    // =================

    /**
     * Safe JSON parse with error handling
     */
    parseJSON(str, defaultValue = null) {
        try {
            return JSON.parse(str);
        } catch (error) {
            return defaultValue;
        }
    }

    /**
     * Safe JSON stringify with error handling
     */
    stringifyJSON(obj, space = null) {
        try {
            return JSON.stringify(obj, null, space);
        } catch (error) {
            return null;
        }
    }

    /**
     * Serialize to JSON-LD format
     */
    serializeJsonLD(obj, context = {}) {
        const jsonLD = {
            '@context': context,
            ...obj
        };

        return this.stringifyJSON(jsonLD, 2);
    }

    /**
     * Deserialize from JSON-LD format
     */
    deserializeJsonLD(jsonLDString) {
        const parsed = this.parseJSON(jsonLDString);
        if (!parsed || !parsed['@context']) {
            return null;
        }

        return {
            context: parsed['@context'],
            data: { ...parsed, '@context': undefined }
        };
    }

    // =================
    // Performance
    // =================

    /**
     * Measure execution time of a function
     */
    async measureTime(fn, ...args) {
        const start = performance.now();
        let result;
        let error = null;

        try {
            result = await fn(...args);
        } catch (err) {
            error = err;
        }

        const end = performance.now();
        const duration = end - start;

        if (error) {
            throw error;
        }

        return {
            result,
            duration,
            formatted: this.formatDuration(duration)
        };
    }

    /**
     * Debounce function execution
     */
    debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Throttle function execution
     */
    throttle(fn, limit) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // =================
    // Random Utilities
    // =================

    /**
     * Generate random string
     */
    randomString(length = 10, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return result;
    }

    /**
     * Generate random integer between min and max (inclusive)
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Generate UUID v4
     */
    generateUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // =================
    // URL Utilities
    // =================

    /**
     * Parse URL parameters
     */
    parseUrlParams(url = window.location.href) {
        const params = {};
        const urlObj = new URL(url);
        
        for (const [key, value] of urlObj.searchParams.entries()) {
            params[key] = value;
        }
        
        return params;
    }

    /**
     * Build URL with parameters
     */
    buildUrl(baseUrl, params = {}) {
        const url = new URL(baseUrl);
        
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        
        return url.toString();
    }

    // =================
    // Error Utilities
    // =================

    /**
     * Create error with additional metadata
     */
    createError(message, code = null, metadata = {}) {
        const error = new Error(message);
        error.code = code;
        error.metadata = metadata;
        error.timestamp = new Date().toISOString();
        return error;
    }

    /**
     * Safely execute function with error handling
     */
    async safeExecute(fn, defaultValue = null, ...args) {
        try {
            return await fn(...args);
        } catch (error) {
            console.error('Safe execution failed:', error);
            return defaultValue;
        }
    }
}

// Create and export singleton instance
const utils = new Utils();
export default utils;