(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
      typeof define === 'function' && define.amd ? define(factory) :
         (factory());
}(this, (function () {
   'use strict';

   /**
    * Applies the :focus-visible polyfill at the given scope.
    * A scope in this case is either the top-level Document or a Shadow Root.
    *
    * @param {(Document|ShadowRoot)} scope
    * @see https://github.com/WICG/focus-visible
    */
   function applyFocusVisiblePolyfill(scope) {
      var hadKeyboardEvent = true;
      var hadFocusVisibleRecently = false;
      var hadFocusVisibleRecentlyTimeout = null;

      var inputTypesAllowlist = {
         text: true,
         search: true,
         url: true,
         tel: true,
         email: true,
         password: true,
         number: true,
         date: true,
         month: true,
         week: true,
         time: true,
         datetime: true,
         'datetime-local': true
      };

      /**
       * Helper function for legacy browsers and iframes which sometimes focus
       * elements like document, body, and non-interactive SVG.
       * @param {Element} el
       */
      function isValidFocusTarget(el) {
         if (
            el &&
            el !== document &&
            el.nodeName !== 'HTML' &&
            el.nodeName !== 'BODY' &&
            'classList' in el &&
            'contains' in el.classList
         ) {
            return true;
         }
         return false;
      }

      /**
       * Computes whether the given element should automatically trigger the
       * `focus-visible` class being added, i.e. whether it should always match
       * `:focus-visible` when focused.
       * @param {Element} el
       * @return {boolean}
       */
      function focusTriggersKeyboardModality(el) {
         var type = el.type;
         var tagName = el.tagName;

         if (tagName === 'INPUT' && inputTypesAllowlist[type] && !el.readOnly) {
            return true;
         }

         if (tagName === 'TEXTAREA' && !el.readOnly) {
            return true;
         }

         if (el.isContentEditable) {
            return true;
         }

         return false;
      }

      /**
       * Add the `focus-visible` class to the given element if it was not added by
       * the author.
       * @param {Element} el
       */
      function addFocusVisibleClass(el) {
         if (el.classList.contains('focus-visible')) {
            return;
         }
         el.classList.add('focus-visible');
         el.setAttribute('data-focus-visible-added', '');
      }

      /**
       * Remove the `focus-visible` class from the given element if it was not
       * originally added by the author.
       * @param {Element} el
       */
      function removeFocusVisibleClass(el) {
         if (!el.hasAttribute('data-focus-visible-added')) {
            return;
         }
         el.classList.remove('focus-visible');
         el.removeAttribute('data-focus-visible-added');
      }

      /**
       * If the most recent user interaction was via the keyboard;
       * and the key press did not include a meta, alt/option, or control key;
       * then the modality is keyboard. Otherwise, the modality is not keyboard.
       * Apply `focus-visible` to any current active element and keep track
       * of our keyboard modality state with `hadKeyboardEvent`.
       * @param {KeyboardEvent} e
       */
      function onKeyDown(e) {
         if (e.metaKey || e.altKey || e.ctrlKey) {
            return;
         }

         if (isValidFocusTarget(scope.activeElement)) {
            addFocusVisibleClass(scope.activeElement);
         }

         hadKeyboardEvent = true;
      }

      /**
       * If at any point a user clicks with a pointing device, ensure that we change
       * the modality away from keyboard.
       * This avoids the situation where a user presses a key on an already focused
       * element, and then clicks on a different element, focusing it with a
       * pointing device, while we still think we're in keyboard modality.
       * @param {Event} e
       */
      function onPointerDown(e) {
         hadKeyboardEvent = false;
      }

      /**
       * On `focus`, add the `focus-visible` class to the target if:
       * - the target received focus as a result of keyboard navigation, or
       * - the event target is an element that will likely require interaction
       *   via the keyboard (e.g. a text box)
       * @param {Event} e
       */
      function onFocus(e) {
         // Prevent IE from focusing the document or HTML element.
         if (!isValidFocusTarget(e.target)) {
            return;
         }

         if (hadKeyboardEvent || focusTriggersKeyboardModality(e.target)) {
            addFocusVisibleClass(e.target);
         }
      }

      /**
       * On `blur`, remove the `focus-visible` class from the target.
       * @param {Event} e
       */
      function onBlur(e) {
         if (!isValidFocusTarget(e.target)) {
            return;
         }

         if (
            e.target.classList.contains('focus-visible') ||
            e.target.hasAttribute('data-focus-visible-added')
         ) {
            // To detect a tab/window switch, we look for a blur event followed
            // rapidly by a visibility change.
            // If we don't see a visibility change within 100ms, it's probably a
            // regular focus change.
            hadFocusVisibleRecently = true;
            window.clearTimeout(hadFocusVisibleRecentlyTimeout);
            hadFocusVisibleRecentlyTimeout = window.setTimeout(function () {
               hadFocusVisibleRecently = false;
            }, 100);
            removeFocusVisibleClass(e.target);
         }
      }

      /**
       * If the user changes tabs, keep track of whether or not the previously
       * focused element had .focus-visible.
       * @param {Event} e
       */
      function onVisibilityChange(e) {
         if (document.visibilityState === 'hidden') {
            // If the tab becomes active again, the browser will handle calling focus
            // on the element (Safari actually calls it twice).
            // If this tab change caused a blur on an element with focus-visible,
            // re-apply the class when the user switches back to the tab.
            if (hadFocusVisibleRecently) {
               hadKeyboardEvent = true;
            }
            addInitialPointerMoveListeners();
         }
      }

      /**
       * Add a group of listeners to detect usage of any pointing devices.
       * These listeners will be added when the polyfill first loads, and anytime
       * the window is blurred, so that they are active when the window regains
       * focus.
       */
      function addInitialPointerMoveListeners() {
         document.addEventListener('mousemove', onInitialPointerMove);
         document.addEventListener('mousedown', onInitialPointerMove);
         document.addEventListener('mouseup', onInitialPointerMove);
         document.addEventListener('pointermove', onInitialPointerMove);
         document.addEventListener('pointerdown', onInitialPointerMove);
         document.addEventListener('pointerup', onInitialPointerMove);
         document.addEventListener('touchmove', onInitialPointerMove);
         document.addEventListener('touchstart', onInitialPointerMove);
         document.addEventListener('touchend', onInitialPointerMove);
      }

      function removeInitialPointerMoveListeners() {
         document.removeEventListener('mousemove', onInitialPointerMove);
         document.removeEventListener('mousedown', onInitialPointerMove);
         document.removeEventListener('mouseup', onInitialPointerMove);
         document.removeEventListener('pointermove', onInitialPointerMove);
         document.removeEventListener('pointerdown', onInitialPointerMove);
         document.removeEventListener('pointerup', onInitialPointerMove);
         document.removeEventListener('touchmove', onInitialPointerMove);
         document.removeEventListener('touchstart', onInitialPointerMove);
         document.removeEventListener('touchend', onInitialPointerMove);
      }

      /**
       * When the polfyill first loads, assume the user is in keyboard modality.
       * If any event is received from a pointing device (e.g. mouse, pointer,
       * touch), turn off keyboard modality.
       * This accounts for situations where focus enters the page from the URL bar.
       * @param {Event} e
       */
      function onInitialPointerMove(e) {
         // Work around a Safari quirk that fires a mousemove on <html> whenever the
         // window blurs, even if you're tabbing out of the page. ¯\_(ツ)_/¯
         if (e.target.nodeName && e.target.nodeName.toLowerCase() === 'html') {
            return;
         }

         hadKeyboardEvent = false;
         removeInitialPointerMoveListeners();
      }

      // For some kinds of state, we are interested in changes at the global scope
      // only. For example, global pointer input, global key presses and global
      // visibility change should affect the state at every scope:
      document.addEventListener('keydown', onKeyDown, true);
      document.addEventListener('mousedown', onPointerDown, true);
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('touchstart', onPointerDown, true);
      document.addEventListener('visibilitychange', onVisibilityChange, true);

      addInitialPointerMoveListeners();

      // For focus and blur, we specifically care about state changes in the local
      // scope. This is because focus / blur events that originate from within a
      // shadow root are not re-dispatched from the host element if it was already
      // the active element in its own scope:
      scope.addEventListener('focus', onFocus, true);
      scope.addEventListener('blur', onBlur, true);

      // We detect that a node is a ShadowRoot by ensuring that it is a
      // DocumentFragment and also has a host property. This check covers native
      // implementation and polyfill implementation transparently. If we only cared
      // about the native implementation, we could just check if the scope was
      // an instance of a ShadowRoot.
      if (scope.nodeType === Node.DOCUMENT_FRAGMENT_NODE && scope.host) {
         // Since a ShadowRoot is a special kind of DocumentFragment, it does not
         // have a root element to add a class to. So, we add this attribute to the
         // host element instead:
         scope.host.setAttribute('data-js-focus-visible', '');
      } else if (scope.nodeType === Node.DOCUMENT_NODE) {
         document.documentElement.classList.add('js-focus-visible');
         document.documentElement.setAttribute('data-js-focus-visible', '');
      }
   }

   // It is important to wrap all references to global window and document in
   // these checks to support server-side rendering use cases
   // @see https://github.com/WICG/focus-visible/issues/199
   if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // Make the polyfill helper globally available. This can be used as a signal
      // to interested libraries that wish to coordinate with the polyfill for e.g.,
      // applying the polyfill to a shadow root:
      window.applyFocusVisiblePolyfill = applyFocusVisiblePolyfill;

      // Notify interested libraries of the polyfill's presence, in case the
      // polyfill was loaded lazily:
      var event;

      try {
         event = new CustomEvent('focus-visible-polyfill-ready');
      } catch (error) {
         // IE11 does not support using CustomEvent as a constructor directly:
         event = document.createEvent('CustomEvent');
         event.initCustomEvent('focus-visible-polyfill-ready', false, false, {});
      }

      window.dispatchEvent(event);
   }

   if (typeof document !== 'undefined') {
      // Apply the polyfill to the global document, so that no JavaScript
      // coordination is required to use the polyfill in the top-level document:
      applyFocusVisiblePolyfill(document);
   }

})));

/* Polyfill service v3.25.1
 * For detailed credits and licence information see https://github.com/financial-times/polyfill-service.
 * 
 * UA detected: ie/89.0.0
 * Features requested: Element.prototype.classList
 *  */

(function (undefined) {

   /* No polyfills found for current settings */

})
   .call('object' === typeof window && window || 'object' === typeof self && self || 'object' === typeof global && global || {});;
"use strict";

function DynamicAdapt(type) {
   this.type = type;
}

DynamicAdapt.prototype.init = function () {
   const _this = this;
   // массив объектов
   this.оbjects = [];
   this.daClassname = "_dynamic_adapt_";
   // массив DOM-элементов
   this.nodes = document.querySelectorAll("[data-da]");

   // наполнение оbjects объктами
   for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const data = node.dataset.da.trim();
      const dataArray = data.split(",");
      const оbject = {};
      оbject.element = node;
      оbject.parent = node.parentNode;
      оbject.destination = document.querySelector(dataArray[0].trim());
      оbject.breakpoint = dataArray[1] ? dataArray[1].trim() : "767";
      оbject.place = dataArray[2] ? dataArray[2].trim() : "last";
      оbject.index = this.indexInParent(оbject.parent, оbject.element);
      this.оbjects.push(оbject);
   }

   this.arraySort(this.оbjects);

   // массив уникальных медиа-запросов
   this.mediaQueries = Array.prototype.map.call(this.оbjects, function (item) {
      return '(' + this.type + "-width: " + item.breakpoint + "px)," + item.breakpoint;
   }, this);
   this.mediaQueries = Array.prototype.filter.call(this.mediaQueries, function (item, index, self) {
      return Array.prototype.indexOf.call(self, item) === index;
   });

   // навешивание слушателя на медиа-запрос
   // и вызов обработчика при первом запуске
   for (let i = 0; i < this.mediaQueries.length; i++) {
      const media = this.mediaQueries[i];
      const mediaSplit = String.prototype.split.call(media, ',');
      const matchMedia = window.matchMedia(mediaSplit[0]);
      const mediaBreakpoint = mediaSplit[1];

      // массив объектов с подходящим брейкпоинтом
      const оbjectsFilter = Array.prototype.filter.call(this.оbjects, function (item) {
         return item.breakpoint === mediaBreakpoint;
      });
      matchMedia.addListener(function () {
         _this.mediaHandler(matchMedia, оbjectsFilter);
      });
      this.mediaHandler(matchMedia, оbjectsFilter);
   }
};

DynamicAdapt.prototype.mediaHandler = function (matchMedia, оbjects) {
   if (matchMedia.matches) {
      for (let i = 0; i < оbjects.length; i++) {
         const оbject = оbjects[i];
         оbject.index = this.indexInParent(оbject.parent, оbject.element);
         this.moveTo(оbject.place, оbject.element, оbject.destination);
      }
   } else {
      for (let i = 0; i < оbjects.length; i++) {
         const оbject = оbjects[i];
         if (оbject.element.classList.contains(this.daClassname)) {
            this.moveBack(оbject.parent, оbject.element, оbject.index);
         }
      }
   }
};

// Функция перемещения
DynamicAdapt.prototype.moveTo = function (place, element, destination) {
   element.classList.add(this.daClassname);
   if (place === 'last' || place >= destination.children.length) {
      destination.insertAdjacentElement('beforeend', element);
      return;
   }
   if (place === 'first') {
      destination.insertAdjacentElement('afterbegin', element);
      return;
   }
   destination.children[place].insertAdjacentElement('beforebegin', element);
}

// Функция возврата
DynamicAdapt.prototype.moveBack = function (parent, element, index) {
   element.classList.remove(this.daClassname);
   if (parent.children[index] !== undefined) {
      parent.children[index].insertAdjacentElement('beforebegin', element);
   } else {
      parent.insertAdjacentElement('beforeend', element);
   }
}

// Функция получения индекса внутри родителя
DynamicAdapt.prototype.indexInParent = function (parent, element) {
   const array = Array.prototype.slice.call(parent.children);
   return Array.prototype.indexOf.call(array, element);
};

// Функция сортировки массива по breakpoint и place 
// по возрастанию для this.type = min
// по убыванию для this.type = max
DynamicAdapt.prototype.arraySort = function (arr) {
   if (this.type === "min") {
      Array.prototype.sort.call(arr, function (a, b) {
         if (a.breakpoint === b.breakpoint) {
            if (a.place === b.place) {
               return 0;
            }

            if (a.place === "first" || b.place === "last") {
               return -1;
            }

            if (a.place === "last" || b.place === "first") {
               return 1;
            }

            return a.place - b.place;
         }

         return a.breakpoint - b.breakpoint;
      });
   } else {
      Array.prototype.sort.call(arr, function (a, b) {
         if (a.breakpoint === b.breakpoint) {
            if (a.place === b.place) {
               return 0;
            }

            if (a.place === "first" || b.place === "last") {
               return 1;
            }

            if (a.place === "last" || b.place === "first") {
               return -1;
            }

            return b.place - a.place;
         }

         return b.breakpoint - a.breakpoint;
      });
      return;
   }
};

const da = new DynamicAdapt("max");
da.init();;
function changeArrows(slider, arrowPrev, arrowNext) {
   const prevArr = document.querySelector(`${arrowPrev}`),
      nextArr = document.querySelector(`${arrowNext}`);

   console.log(nextArr);

   prevArr.addEventListener(`click`, () => {
      slider.slidePrev();
   });
   nextArr.addEventListener(`click`, () => {
      slider.slideNext();
   });
};



const howItWasSlider = new Swiper('.how-it-was-slider', {
   loop: true,
   pagination: {
      el: '.swiper-pagination',
      type: 'bullets',
      clickable: true,
   },

   slidesPerView: 1,
   centeredSlides: true,
   breakpoints: {
      767: {
         slidesPerView: 3,
      },
      600: {
         slidesPerView: 2,
      },
      496: {
         slidesPerView: 1.4,
      }
   },

});
changeArrows(howItWasSlider, '.how-it-was__swiper-button-prev', '.how-it-was__swiper-button-next');
const reviewsSlider = new Swiper('.reviews-slider', {
   loop: true,
   navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
   },
   pagination: {
      el: '.swiper-pagination',
   },
   slidesPerView: 1,
});


