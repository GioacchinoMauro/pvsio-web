/**
 * @author Gioacchino Mauro
 * @date Mon Oct 12 13:43:39 2015
 *
 * MISRA C code printer for emucharts models.
 * Emuchart objects have the following structure:
      emuchart = {
                name: (string),
                author: {
                    name: (string),
                    affiliation: (string),
                    contact: (string)
                },
                importings: (not used for now),
                constants: (array of {
                                name: (string), // the constant identifier
                                type: (string), // the constant type
                                value: (string) // the constant value (can be undefined)
                            }),
                variables: (array of {
                                name: (string), // the variable identifier
                                type: (string), // the variable type
                                scope: (string) // the variable scope, either local or global
                            }),
                states: (array of {
                                name: (string), // the state label
                                id: (string),   // a unique identifier
                            }),
                transitions: (array of {
                                name: (string), // the transition label
                                id: (string),   // a unique identifier
                                source: {
                                    name: (string), // the source state label
                                    id: (string)    // a unique identifier
                                },
                                target: {
                                    name: (string), // the target state label
                                    id: (string)    // a unique identifier
                                },
                            }),
                initial_transitions: (array of {
                                name: (string), // the initial transition label
                                id: (string),   // a unique identifier
                                target: {
                                    name: (string), // the target state label
                                    id: (string)    // a unique identifier
                                },
                            })
      }
 */
define(function (require, exports, module) {
    var threadTemplate = require("text!plugins/emulink/models/misraC/templates/thread.handlebars");
    var headerTemplate = require("text!plugins/emulink/models/misraC/templates/header.handlebars");
    var EmuchartsParser = require("plugins/emulink/EmuchartsParser");
    var displayNotificationView  = require("plugins/emulink/forms/displayNotificationView");
    var _parser = new EmuchartsParser();
    
    var displayNotification = function (msg, title) {
        title = title || "Notification";
        displayNotificationView.create({
            header: title,
            message: msg,
            buttons: ["Ok"]
        }).on("ok", function (e, view) {
            view.remove();
        });
    };
    var displayError = function (msg) {
        displayNotification(msg, "Compilation Error");
    };

    var machineStateType = "state";
    var initialMachineState = "initialMachineState";
    var predefined_variables = {
        previous_state: { name: "previous_state", type: machineStateType, value: initialMachineState },
        current_state: { name: "current_state", type: machineStateType, value: initialMachineState }
    };
    
    var operatorOverrides = {
        ":=": "=",
        "AND": "&&",
        "OR": "||",
        "NOT": "!",
        "and": "&&",
        "or": "||",
        "not": "!",
        "=": "=="
    };
    
    var declarations = [];
    declarations.push("typedef unsigned char UC_8;");
    
    //var variablesUsed = [];
    
    function getType(type) {
        var typeMaps = {
            "Time": "Time",    //iachino: Serve??
            "bool": "UC_8",
            "int": "UI_32",
            "float" : "F_32",
            "double": "D_64"                      
        };
        if ( (type.toLowerCase() === "bool") || (type.toLowerCase() === "boolean") ) {
            type = typeMaps.bool;
            if(!isInArray(declarations, "true")){
                declarations.push("#define true 1");
                declarations.push("#define false 0");
                declarations.push("#define TRUE 1");
                declarations.push("#define FALSE 0");
            }    
        }
        if (type.toLowerCase() === "int") {
            type = typeMaps.int;
            if(!isInArray(declarations, type)){
                declarations.push("typedef unsigned int " + type + ";");
            }
        }
        if (type.toLowerCase() === "float"){
            type = typeMaps.float;
            if(!isInArray(declarations, type)){
                declarations.push("typedef float " + type + ";");
            }
        }
        if ((type.toLowerCase() === "real") || (type.toLowerCase() === "double")){
            type = typeMaps.double;
            if(!isInArray(declarations, type)){
                declarations.push("typedef double " + type + ";");
            }
        }
        return typeMaps[type] || type;
    }
    
    function setSuffix(v) {
        if (isNumber(v.value)){
            if ( v.type.toUpperCase() === getType("int") ) {
                v.value = v.value + "u";
            }
            if ( (v.type.toUpperCase() === getType("float")) || (v.type.toUpperCase() === getType("double")) ){
                v.value = v.value + "f";
            }
        }
        return v.value;
    }
    /** devo scorrere i vari 'v.type', vedere se sono 'identifier' o 'constant' e 
     * confrontare 'v.val' con un array di variabili usate
     * e.g.   v={(array of)
     *            type:   (indentifier|constant|binop|number)
     *            val:    (display|3.14|=|27)
     *        }
    **/
    // function getSuffixInActions(v) {
    //     console.log(variablesUsed + v);
    //     if (isInArray(variablesUsed, v.val)){
    //         var arrayJoin = variablesUsed.join();       //not good
    //         var tipo = arrayJoin.indexOf(v.val);        //not good
    //         // if ( v. === getType("int") ) {
    //         //     return "u";
    //         // }
    //         // if ( (v.type.toUpperCase() === getType("float")) || (v.type.toUpperCase() === getType("double")) ){
    //         //     return "f";
    //         // }
    //     }
    //     return;
    // }

    function getOperator(op, emuchart) {
        return operatorOverrides[op] || op;
    }
    
    function isInArray(array, search)
    {
        var arrayJoin = array.join();
        return arrayJoin.indexOf(search) >= 0;
    }
    
    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
    
    function isLocalVariable(name, emuchart) {
        if (name === predefined_variables.current_state.name ||
                name === predefined_variables.previous_state.name) {
            return true;
        }
        if (emuchart.variables && emuchart.variables.local) {
            var i = 0;
            for (i = 0; i < emuchart.variables.local.length; i++) {
                if (name === emuchart.variables.local[i].name) {
                    return true;
                }
            }
        }
        return false;
    }
    // function isInputVariable(name, emuchart) {
    //     if (emuchart.variables && emuchart.variables.input) {
    //         var i = 0;
    //         for (i = 0; i < emuchart.variables.input.length; i++) {
    //             if (name === emuchart.variables.input[i].name) {
    //                 return true;
    //             }
    //         }
    //     }
    //     return false;
    // }
    // function isOutputVariable(name, emuchart) {
    //     if (emuchart.variables && emuchart.variables.output) {
    //         var i = 0;
    //         for (i = 0; i < emuchart.variables.output.length; i++) {
    //             if (name === emuchart.variables.output[i].name) {
    //                 return true;
    //             }
    //         }
    //     }
    //     return false;
    // }
    
    function parseTransition(t, emuchart) {
        function getExpression(expression, emuchart) {
            var complexActions = ["expression", "assignment", "function"];
            if (expression === undefined || expression === null) {
                return "";
            }
            if (expression.type === "assignment") {
                var name = expression.val.identifier.val;
                expression.val.expression.val.map(function (v) {
                    v.val = v.val.toLowerCase();
                    return;
                });
                if (isLocalVariable(name, emuchart)) {
                    return name + " = " +
                            getExpression(expression.val.expression, emuchart);                
                }
                return name + "(" +
                        getExpression(expression.val.expression, emuchart) + ")";
            } else {
                if (Array.isArray(expression.val)) {
                    var res = expression.val.map(function (token) {
                        if (complexActions.indexOf(token.val) > -1) {
                            return getExpression(token.val, emuchart);
                        } else {
                            return getOperator(token.val, emuchart);
                        }
                    });
                    return res.join(" ");
                } else {
                    if (complexActions.indexOf(expression.val) > -1) {
                        return getExpression(expression.val, emuchart);
                    } else {
                        return getOperator(expression.val, emuchart);
                    }
                }
            }
        }        
        var name = t.name;
        var functionBody = _parser.parseTransition(name);
        if (functionBody.res) {
            functionBody = functionBody.res.val;
            var id = functionBody.identifier;
            var condition = functionBody.cond;
            var actions = functionBody.actions;
            if (condition) {
                condition = condition.val.map(function (token) {
                    return getExpression(token, emuchart);
                }).join(" ");
            }
            if (actions) {
                actions = actions.val.map(function (a) {
                    // a.val.expression.val.map(function(b){
                    //     if(b.type === "number"){
                    //         b.val+= getSuffixInActions(a);     //return "f" or "u"
                    //     }
                    //     console.log(b);
                    // });
                    return getExpression(a, emuchart);
                });
            }
            return {id: id.val, actions: actions, condition: condition, source: t.source, target: t.target};
        } else if (functionBody.err) {
            displayError(functionBody.err);
            return { erroneousLabel: name, parserError: functionBody.err };
        }
    }
    
    function Printer(name) {
        this.modelName = name;
        this.model = {modelName: name, transitions: []};
    }

    Printer.prototype.constructor = Printer;

    Printer.prototype.print_variables = function (emuchart) {
        if (emuchart.variables) {
            this.model.input_variables = emuchart.variables.input.map(function (v) {
                v.type = getType(v.type);
                v.value = setSuffix(v);
                return v;
            });
            this.model.output_variables = emuchart.variables.output.map(function (v) {
                v.type = getType(v.type);
                v.value = setSuffix(v);
                if (v.type.toLowerCase() === 'monitor_mode'){
                    v.value = "\"" + v.value.toLowerCase() + "\"";
                }
                return v;
            });
            this.model.local_variables = emuchart.variables.local.map(function (v) {
                v.type = getType(v.type);
                v.value = setSuffix(v);
                return v;
            });
        }
    };

    Printer.prototype.print_constants = function (emuchart) {
        this.model.constants = emuchart.constants.map(function (v) {
            v.type = getType(v.type);
            v.value = setSuffix(v);
            v.name = v.name.toUpperCase();
            return v;
        });
    };

    Printer.prototype.print_declarations = function (emuchart) {
        this.model.importings = declarations;
        if (emuchart.variables) {
            this.model.structureVar = emuchart.variables.local.map(function (v) {
                v.type = getType(v.type);
                return (v.type + " "+ v.name + ";");
            });
        }
        this.model.structureVar.push("UC_8 *" + predefined_variables.current_state.name + ";");
        this.model.structureVar.push("UC_8 *" + predefined_variables.previous_state.name + ";");
        // variablesUsed = this.model.structureVar;    
    };
    
    Printer.prototype.print_transitions = function (emuchart) {
        var transitions = [];
        var functionsName = [];
        emuchart.transitions.forEach(function (t) {
            var parsedTransition  = parseTransition(t, emuchart);
            if (parsedTransition) {
                 if(!isInArray(functionsName, parsedTransition.id)){
                     functionsName.push(parsedTransition.id);
                     transitions.push(parsedTransition);
                 }
                 else{                 
                     var i;
                     for ( i = 0; i < transitions.length; i++){
                         if(transitions[i].id !== 'undefined'){
                            if (transitions[i].id === parsedTransition.id){
                                var tmp = [];
                                tmp.push(transitions[i]);
                                tmp.push(parsedTransition);
                                transitions[i] = tmp;
                            }
                            else{
                                var j;
                                for (j = 0; j < transitions[i].length; j++){
                                    if (transitions[i][j].id === parsedTransition.id){
                                        var tmp2 = [];
                                        transitions[i].map(function (v) {
                                            tmp2.push(v);
                                            return;
                                        });
                                        tmp2.push(parsedTransition);
                                        transitions[i] = tmp2;
                                        break;
                                    }
                                }
                            }
                         }
                     }
                 }
            }
        });
        if (transitions) {
            this.model.transitions = this.model.transitions.concat(transitions);
        }
    };
    
    Printer.prototype.print_initial_transition = function (emuchart) {
        var initial_transitions = emuchart.initial_transitions,
            i = 0,
            transitions = [];
        initial_transitions.forEach(function (t) {
            Handlebars.registerHelper('init_suffix', function(emuchart) {
                if (initial_transitions[i]){
                    i++;
                    if( (initial_transitions[i-1].name === "") || !(initial_transitions[i-1].name[0].match(/[a-z]/i)) ){
                        return;
                    }
                    else{
                        return "_" + initial_transitions[i-1].name.substr(0,3);
                    }
                }
            });
            Handlebars.registerHelper('init_suffix_for_header', function(emuchart) {
                if (initial_transitions[i-1]){
                    if( (initial_transitions[i-1].name === "") || !(initial_transitions[i-1].name[0].match(/[a-z]/i)) ){
                        return;
                    }
                    else{
                        return "_" + initial_transitions[i-1].name.substr(0,3);
                    }
                }
            });
            var parsedInit = parseTransition(t, emuchart);
            if (parsedInit) {
                transitions.push(parsedInit);
            }
        });
        if (transitions) {
            this.model.initial_transitions = transitions;
        }
    };
    

    Printer.prototype.print_types = function (emuchart) {
    };

    Printer.prototype.print_states = function (emuchart) {
        this.model.states = emuchart.states;
    };
    
    Printer.prototype.print_descriptor = function (emuchart) {
        this.model.descriptor = 
            "/**---------------------------------------------------------------" +
            "\n*   Model: " + emuchart.name;
        Handlebars.registerHelper('filename', function() {
                return emuchart.name;
        });
        if (emuchart.author) {
            this.model.descriptor += 
                "\n*   Author: " + emuchart.author.name +
                "\n*           " + emuchart.author.affiliation +
                "\n*           " + emuchart.author.contact;
        }
        if (emuchart.description) {
            this.model.descriptor += 
                "\n*  ---------------------------------------------------------------" +
                "\n*   " + emuchart.description;
        }
        this.model.descriptor += 
            "\n*  ---------------------------------------------------------------*/\n";
    };
            
    Printer.prototype.print_disclaimer = function (emuchart) {
        this.model.disclaimer = "\n/** ---------------------------------------------------------------\n" +
                    "*   C code generated using PVSio-web MisraCPrinter ver 0.1\n" +
                    "*   Tool freely available at http://www.pvsioweb.org" +
                    "\n*  --------------------------------------------------------------*/\n";
    };
    

    Printer.prototype.print = function (emuchart) {
        this.model.transitions = [];
        this.print_variables(emuchart);
        this.print_declarations(emuchart);
        this.print_constants(emuchart);
        this.print_transitions(emuchart);
        this.print_initial_transition(emuchart);
        this.print_states(emuchart);
        this.print_disclaimer(emuchart);
        this.print_descriptor(emuchart);
        
        console.log(this.model);//TO debug
        
        var thread = Handlebars.compile(threadTemplate)(this.model);
        var header = Handlebars.compile(headerTemplate)(this.model);
        return {thread: thread, header: header};
    };

    module.exports = Printer;
    
    declarations = [];
});
