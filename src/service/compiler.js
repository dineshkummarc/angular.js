'use strict';


function $CompileProvider(){
  this.$get = ['$injector', '$exceptionHandler', '$textMarkup', '$attrMarkup', '$directive', '$widget',
    function(   $injector,   $exceptionHandler,   $textMarkup,   $attrMarkup,   $directive,   $widget){
      /**
       * Template provides directions an how to bind to a given element.
       * It contains a list of init functions which need to be called to
       * bind to a new instance of elements. It also provides a list
       * of child paths which contain child templates
       */
      function Template() {
        this.paths = [];
        this.children = [];
        this.linkFns = [];
        this.newScope = false;
      }

      Template.prototype = {
        link: function(element, scope) {
          var childScope = scope,
              locals = {$element: element};
          if (this.newScope) {
            childScope = isFunction(this.newScope) ? scope.$new(this.newScope(scope)) : scope.$new();
            element.data($$scope, childScope);
          }
          forEach(this.linkFns, function(fn) {
            try {
              if (isArray(fn) || fn.$inject) {
                $injector.invoke(childScope, fn, locals);
              } else {
                fn.call(childScope, element);
              }
            } catch (e) {
              $exceptionHandler(e);
            }
          });
          var i,
              childNodes = element[0].childNodes,
              children = this.children,
              paths = this.paths,
              length = paths.length;
          for (i = 0; i < length; i++) {
            // sometimes `element` can be modified by one of the linker functions in `this.linkFns`
            // and childNodes may be added or removed
            // TODO: element structure needs to be re-evaluated if new children added
            // if the childNode still exists
            if (childNodes[paths[i]])
              children[i].link(jqLite(childNodes[paths[i]]), childScope);
            else
              delete paths[i]; // if child no longer available, delete path
          }
        },


        addLinkFn:function(linkingFn) {
          if (linkingFn) {
            this.linkFns.push(linkingFn);
          }
        },


        addChild: function(index, template) {
          if (template) {
            this.paths.push(index);
            this.children.push(template);
          }
        },

        empty: function() {
          return this.linkFns.length === 0 && this.paths.length === 0;
        }
      };

      ///////////////////////////////////
      //Compiler
      //////////////////////////////////

      /**
       * @ngdoc function
       * @name angular.module.ng.$compile
       * @function
       *
       * @description
       * Compiles a piece of HTML string or DOM into a template and produces a template function, which
       * can then be used to link {@link angular.module.ng.$rootScope.Scope scope} and the template together.
       *
       * The compilation is a process of walking the DOM tree and trying to match DOM elements to
       * {@link angular.markup markup}, {@link angular.attrMarkup attrMarkup},
       * {@link angular.widget widgets}, and {@link angular.directive directives}. For each match it
       * executes corresponding markup, attrMarkup, widget or directive template function and collects the
       * instance functions into a single template function which is then returned.
       *
       * The template function can then be used once to produce the view or as it is the case with
       * {@link angular.widget.@ng:repeat repeater} many-times, in which case each call results in a view
       * that is a DOM clone of the original template.
       *
         <pre>
          angular.injector('ng').invoke(null, function($rootScope, $compile) {
            // Chose one:

            // A: compile the entire window.document.
            var element = $compile(window.document)($rootScope);

            // B: compile a piece of html
            var element = $compile('<div ng:click="clicked = true">click me</div>')($rootScope);

            // C: compile a piece of html and retain reference to both the dom and scope
            var element = $compile('<div ng:click="clicked = true">click me</div>')(scope);
            // at this point template was transformed into a view
          });
         </pre>
       *
       *
       * @param {string|DOMElement} element Element or HTML to compile into a template function.
       * @returns {function(scope[, cloneAttachFn])} a template function which is used to bind template
       * (a DOM element/tree) to a scope. Where:
       *
       *  * `scope` - A {@link angular.module.ng.$rootScope.Scope Scope} to bind to.
       *  * `cloneAttachFn` - If `cloneAttachFn` is provided, then the link function will clone the
       *               `template` and call the `cloneAttachFn` function allowing the caller to attach the
       *               cloned elements to the DOM document at the appropriate place. The `cloneAttachFn` is
       *               called as: <br/> `cloneAttachFn(clonedElement, scope)` where:
       *
       *      * `clonedElement` - is a clone of the original `element` passed into the compiler.
       *      * `scope` - is the current scope with which the linking function is working with.
       *
       * Calling the template function returns the element of the template. It is either the original element
       * passed in, or the clone of the element if the `cloneAttachFn` is provided.
       *
       * It is important to understand that the returned scope is "linked" to the view DOM, but no linking
       * (instance) functions registered by {@link angular.directive directives} or
       * {@link angular.widget widgets} found in the template have been executed yet. This means that the
       * view is likely empty and doesn't contain any values that result from evaluation on the scope. To
       * bring the view to life, the scope needs to run through a $digest phase which typically is done by
       * Angular automatically, except for the case when an application is being
       * {@link guide/dev_guide.bootstrap.manual_bootstrap} manually bootstrapped, in which case the
       * $digest phase must be invoked by calling {@link angular.module.ng.$rootScope.Scope#$apply}.
       *
       * If you need access to the bound view, there are two ways to do it:
       *
       * - If you are not asking the linking function to clone the template, create the DOM element(s)
       *   before you send them to the compiler and keep this reference around.
       *   <pre>
       *     var $injector = angular.injector('ng');
       *     var scope = $injector.invoke(null, function($rootScope, $compile){
       *       var element = $compile('<p>{{total}}</p>')($rootScope);
       *     });
       *   </pre>
       *
       * - if on the other hand, you need the element to be cloned, the view reference from the original
       *   example would not point to the clone, but rather to the original template that was cloned. In
       *   this case, you can access the clone via the cloneAttachFn:
       *   <pre>
       *     var original = angular.element('<p>{{total}}</p>'),
       *         scope = someParentScope.$new(),
       *         clone;
       *
       *     $compile(original)(scope, function(clonedElement, scope) {
       *       clone = clonedElement;
       *       //attach the clone to DOM document at the right place
       *     });
       *
       *     //now we have reference to the cloned DOM via `clone`
       *   </pre>
       *
       *
       * Compiler Methods For Widgets and Directives:
       *
       * The following methods are available for use when you write your own widgets, directives,
       * and markup.  (Recall that the compile function's this is a reference to the compiler.)
       *
       *  `compile(element)` - returns linker -
       *  Invoke a new instance of the compiler to compile a DOM element and return a linker function.
       *  You can apply the linker function to the original element or a clone of the original element.
       *  The linker function returns a scope.
       *
       *  * `comment(commentText)` - returns element - Create a comment element.
       *
       *  * `element(elementName)` - returns element - Create an element by name.
       *
       *  * `text(text)` - returns element - Create a text element.
       *
       *  * `descend([set])` - returns descend state (true or false). Get or set the current descend
       *  state. If true the compiler will descend to children elements.
       *
       *  * `directives([set])` - returns directive state (true or false). Get or set the current
       *  directives processing state. The compiler will process directives only when directives set to
       *  true.
       *
       * For information on how the compiler works, see the
       * {@link guide/dev_guide.compiler Angular HTML Compiler} section of the Developer Guide.
       */
      function Compiler(markup, attrMarkup, directives, widgets){
        this.markup = markup;
        this.attrMarkup = attrMarkup;
        this.directives = directives;
        this.widgets = widgets;
      }

      Compiler.prototype = {
        compile: function(templateElement) {
          templateElement = jqLite(templateElement);
          var index = 0,
              template,
              parent = templateElement.parent();
          if (templateElement.length > 1) {
            // https://github.com/angular/angular.js/issues/338
            throw Error("Cannot compile multiple element roots: " +
                jqLite('<div>').append(templateElement.clone()).html());
          }
          if (parent && parent[0]) {
            parent = parent[0];
            for(var i = 0; i < parent.childNodes.length; i++) {
              if (parent.childNodes[i] == templateElement[0]) {
                index = i;
              }
            }
          }
          template = this.templatize(templateElement, index) || new Template();
          return function(scope, cloneConnectFn){
            assertArg(scope, 'scope');
            // important!!: we must call our jqLite.clone() since the jQuery one is trying to be smart
            // and sometimes changes the structure of the DOM.
            var element = cloneConnectFn
              ? JQLitePrototype.clone.call(templateElement) // IMPORTANT!!!
              : templateElement;
            element.data($$scope, scope);
            scope.$element = element;
            (cloneConnectFn||noop)(element, scope);
            template.link(element, scope);
            return element;
          };
        },

        templatize: function(element, elementIndex){
          var self = this,
              widget,
              fn,
              directiveFns = self.directives,
              descend = true,
              directives = true,
              elementName = nodeName_(element),
              elementNamespace = elementName.indexOf(':') > 0 ? lowercase(elementName).replace(':', '-') : '',
              template,
              locals = {$element: element},
              selfApi = {
                compile: bind(self, self.compile),
                descend: function(value){ if(isDefined(value)) descend = value; return descend;},
                directives: function(value){ if(isDefined(value)) directives = value; return directives;},
                scope: function(value){ if(isDefined(value)) template.newScope = template.newScope || value; return template.newScope;}
              };
          element.addClass(elementNamespace);
          template = new Template();
          eachAttribute(element, function(value, name){
            if (!widget) {
              if ((widget = self.widgets('@' + name))) {
                element.addClass('ng-attr-widget');
                if (isFunction(widget) && !widget.$inject) {
                  widget.$inject = ['$value', '$element'];
                }
                locals.$value = value;
              }
            }
          });
          if (!widget) {
            if ((widget = self.widgets(elementName))) {
              if (elementNamespace)
                element.addClass('ng-widget');
              if (isFunction(widget) && !widget.$inject) {
                widget.$inject = ['$element'];
              }
            }
          }
          if (widget) {
            descend = false;
            directives = false;
            var parent = element.parent();
            template.addLinkFn($injector.invoke(selfApi, widget, locals));
            if (parent && parent[0]) {
              element = jqLite(parent[0].childNodes[elementIndex]);
            }
          }
          if (descend){
            // process markup for text nodes only
            for(var i=0, child=element[0].childNodes;
                i<child.length; i++) {
              if (isTextNode(child[i])) {
                forEach(self.markup, function(markup){
                  if (i<child.length) {
                    var textNode = jqLite(child[i]);
                    markup.call(selfApi, textNode.text(), textNode, element);
                  }
                });
              }
            }
          }

          if (directives) {
            // Process attributes/directives
            eachAttribute(element, function(value, name){
              forEach(self.attrMarkup, function(markup){
                markup.call(selfApi, value, name, element);
              });
            });
            eachAttribute(element, function(value, name){
              name = lowercase(name);
              fn = directiveFns[name];
              if (fn) {
                element.addClass('ng-directive');
                template.addLinkFn((isArray(fn) || fn.$inject)
                  ? $injector.invoke(selfApi, fn, {$value:value, $element: element})
                  : fn.call(selfApi, value, element));
              }
            });
          }
          // Process non text child nodes
          if (descend) {
            eachNode(element, function(child, i){
              template.addChild(i, self.templatize(child, i));
            });
          }
          return template.empty() ? null : template;
        }
      };

      /////////////////////////////////////////////////////////////////////
      var compiler = new Compiler($textMarkup, $attrMarkup, $directive, $widget);
      return bind(compiler, compiler.compile);
    }];
};


function eachNode(element, fn){
  var i, chldNodes = element[0].childNodes || [], chld;
  for (i = 0; i < chldNodes.length; i++) {
    if(!isTextNode(chld = chldNodes[i])) {
      fn(jqLite(chld), i);
    }
  }
}

function eachAttribute(element, fn){
  var i, attrs = element[0].attributes || [], chld, attr, name, value, attrValue = {};
  for (i = 0; i < attrs.length; i++) {
    attr = attrs[i];
    name = attr.name;
    value = attr.value;
    if (msie && name == 'href') {
      value = decodeURIComponent(element[0].getAttribute(name, 2));
    }
    attrValue[name] = value;
  }
  forEachSorted(attrValue, fn);
}
