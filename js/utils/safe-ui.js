/**
 * @fileoverview SafeUI - Safe UI manipulation wrapper
 * Automatically handles null/undefined DOM elements to eliminate repetitive null checks
 */

/**
 * SafeUI - A wrapper that safely manipulates DOM elements
 * All methods gracefully handle null/undefined elements
 */
export class SafeUI {
    /**
     * Create a SafeUI wrapper
     * @param {Object} elements - Object containing DOM element references
     */
    constructor(elements) {
        this.elements = elements || {};
    }

    /**
     * Add CSS class(es) to element(s)
     * @param {string|string[]} selector - Element key(s) from this.elements
     * @param {string|string[]} className - Class name(s) to add
     */
    addClass(selector, className) {
        const elements = this._getElements(selector);
        const classes = Array.isArray(className) ? className : [className];
        elements.forEach(el => {
            if (el && el.classList) {
                el.classList.add(...classes);
            }
        });
    }

    /**
     * Remove CSS class(es) from element(s)
     * @param {string|string[]} selector - Element key(s) from this.elements
     * @param {string|string[]} className - Class name(s) to remove
     */
    removeClass(selector, className) {
        const elements = this._getElements(selector);
        const classes = Array.isArray(className) ? className : [className];
        elements.forEach(el => {
            if (el && el.classList) {
                el.classList.remove(...classes);
            }
        });
    }

    /**
     * Set text content of element(s)
     * @param {string|string[]} selector - Element key(s) from this.elements
     * @param {string} text - Text content to set
     */
    setText(selector, text) {
        const elements = this._getElements(selector);
        elements.forEach(el => {
            if (el) {
                el.textContent = text;
            }
        });
    }

    /**
     * Set HTML content of element(s)
     * @param {string|string[]} selector - Element key(s) from this.elements
     * @param {string} html - HTML content to set
     */
    setHTML(selector, html) {
        const elements = this._getElements(selector);
        elements.forEach(el => {
            if (el) {
                el.innerHTML = html;
            }
        });
    }

    /**
     * Get value from element
     * @param {string} selector - Element key from this.elements
     * @returns {string|null} Element value or null
     */
    getValue(selector) {
        const el = this._getElement(selector);
        return el?.value ?? null;
    }

    /**
     * Set value of element
     * @param {string} selector - Element key from this.elements
     * @param {string} value - Value to set
     */
    setValue(selector, value) {
        const el = this._getElement(selector);
        if (el) {
            el.value = value;
        }
    }

    /**
     * Check if element has a class
     * @param {string} selector - Element key from this.elements
     * @param {string} className - Class name to check
     * @returns {boolean} True if element has the class
     */
    hasClass(selector, className) {
        const el = this._getElement(selector);
        return el?.classList?.contains(className) ?? false;
    }

    /**
     * Toggle CSS class on element(s)
     * @param {string|string[]} selector - Element key(s) from this.elements
     * @param {string} className - Class name to toggle
     * @param {boolean} [force] - Optional force state (true=add, false=remove)
     */
    toggleClass(selector, className, force) {
        const elements = this._getElements(selector);
        elements.forEach(el => {
            if (el && el.classList) {
                el.classList.toggle(className, force);
            }
        });
    }

    /**
     * Show element(s) by removing 'hidden' class
     * @param {string|string[]} selector - Element key(s) from this.elements
     */
    show(selector) {
        this.removeClass(selector, 'hidden');
    }

    /**
     * Hide element(s) by adding 'hidden' class
     * @param {string|string[]} selector - Element key(s) from this.elements
     */
    hide(selector) {
        this.addClass(selector, 'hidden');
    }

    /**
     * Batch update multiple elements with different operations
     * @param {Object} updates - Object mapping selectors to operations
     * @example
     * safeUI.batchUpdate({
     *   startBtn: { addClass: 'hidden' },
     *   stopBtn: { removeClass: 'hidden', setText: 'Stop' },
     *   status: { setText: 'Running', addClass: ['active', 'pulse'] }
     * })
     */
    batchUpdate(updates) {
        Object.entries(updates).forEach(([selector, operations]) => {
            Object.entries(operations).forEach(([op, value]) => {
                switch(op) {
                    case 'addClass':
                        this.addClass(selector, value);
                        break;
                    case 'removeClass':
                        this.removeClass(selector, value);
                        break;
                    case 'toggleClass':
                        this.toggleClass(selector, value);
                        break;
                    case 'setText':
                        this.setText(selector, value);
                        break;
                    case 'setHTML':
                        this.setHTML(selector, value);
                        break;
                    case 'setValue':
                        this.setValue(selector, value);
                        break;
                    case 'show':
                        this.show(selector);
                        break;
                    case 'hide':
                        this.hide(selector);
                        break;
                }
            });
        });
    }

    /**
     * Get element(s) from selector(s)
     * @param {string|string[]} selector - Element key(s)
     * @returns {Array} Array of elements
     * @private
     */
    _getElements(selector) {
        if (Array.isArray(selector)) {
            return selector.map(s => this.elements[s]).filter(Boolean);
        }
        const el = this.elements[selector];
        return el ? [el] : [];
    }

    /**
     * Get single element from selector
     * @param {string} selector - Element key
     * @returns {HTMLElement|null} Element or null
     * @private
     */
    _getElement(selector) {
        return this.elements[selector] ?? null;
    }
}
