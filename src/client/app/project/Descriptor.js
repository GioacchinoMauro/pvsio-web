/**
 * @module Descriptor
 * @desc Module representing a file in  a project
 * @author Patrick Oladimeji
 * @date 11/15/13 10:19:27 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, Promise*/
define(function (require, exports, module) {
	"use strict";
	var property = require("util/property"),
		eventDispatcher = require("util/eventDispatcher");
    var WSManager = require("websockets/pvs/WSManager");
    var imageExtensions = [".jpg", ".jpeg", ".png"];
	/**
	 * @constructor
	 * @param {string} path The name of the file, i.e., the *relative path* from the project directory
     * @param {string} content the content of the file.
	 * @this Descriptor
	 */
    function Descriptor(path, content, opt) {
        eventDispatcher(this);
        var pf = this;
		/** get or set the dirty flag on this file. A file is dirty if its content has been edited but not persisted 
			@type {boolean}
		*/
        this.dirty = property.call(this, false);
        //fire event whenever the dirty flag changes
        this.dirty.addListener("PropertyChanged", function (event) {
            pf.fire({type: "DirtyFlagChanged",  previous: event.old,
                       current: event.fresh, path: path});
        });
        
		/**
		 * file or directory path
		 */
        this.path = path;
		
        /**
         * file or directory name
		 */
        this.name = this.path.split("/").slice(-1).join("");

        /**
         * whether this is a directory or a file (default: false)
		 */
        this.isDirectory = (opt && opt.isDirectory) ? opt.isDirectory : false;
        
        if (!this.isDirectory) {
            /** 
             * MIME type (default "text/plain")
             */
            this.type = "text/plain";

            /**
             * file content
             */
            this.content = content;

            /**
             * file encoding (default "utf8")
             */
            this.encoding = (opt && opt.encoding) ? opt.encoding : "utf8";
            
            /**
             * file extension
             */
            this.extension = (this.name.indexOf(".") > -1) ? this.name.substring(this.name.lastIndexOf(".")) : "";
        }
                
        //-----
		/** get or set the visibility of this file in the project view
			@type {boolean}
            @deprecated
		*/
		this.visible = property.call(this, true);
        return pf;
    }
    
    Descriptor.prototype.isImage = function () {
        return (this.extension &&
                    imageExtensions.indexOf(this.extension.toLowerCase()) > -1) ||
                        (this.encoding === "base64");
    };
    
    Descriptor.prototype.isPVSFile = function () {
        return (this.extension && this.extension === ".pvs");
    };
    /**
     * Overrides toString for Descriptor
     * @returns {String}
     */
    Descriptor.prototype.toString = function () {
        return JSON.stringify(this);
    };
    
    /**
     * @function getContent
     * @description Returns the file content. Clients should always use this function to retrieve the file content,
     * rather than reading field content --- field content can be null because the server does not always pass the file
     * content to optimise communication, and this function automatically handles this situation as follows: 
     * if the descriptor's field content is non-null, then the value of field content is returned; 
     * otherwise, the a request is sent to the server to retrieve the file content from disk.
     * @memberof module:Descriptor
     * @instance
     */
    Descriptor.prototype.getContent = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.content) {
                resolve(_this.content);
            } else {
                _this.encoding = (_this.isImage(_this.name)) ? "base64" : "utf8";
                var token = {
                    path: _this.path,
                    encoding: _this.encoding
                };
                WSManager.getWebSocket().readFile(token, function (err, res) {
                    if (err) {
                        reject(err);
                    } else {
                        _this.content = res.content;
                        resolve(_this.content);
                    }
                });
            }
        });
    };
    
    /**
     * @function save
     * @description Saves the file descriptor on disk.
     * @param opt {Object {overWrite: bool}} Options for the save function: 
     *             overWrite (bool) defines whether the project can be overwritten.
     * @returns {Promise(Descriptor)} A Promise that resolves to the saved content.
     * @memberof module:Descriptor
     * @instance
     */
    Descriptor.prototype.save = function (opt) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.getContent().then(function (res) {
                var token = {
                    name: _this.name,
                    path: _this.path,
                    content: _this.content,
                    encoding: _this.encoding || "utf8",
                    opt: opt
                };
                WSManager.getWebSocket().writeFile(token, function (err, res) {
                    if (err) {
                        console.log(err);
                        reject(err);
                    } else {
                        _this.dirty(false);
                        _this.fire({type: "DirtyFlagChanged", file: _this});
                        resolve(_this.content);
                    }
                });
            }).catch(function (err) {
                reject(err);
            });
        });
    };

    
    /**
     * FIXME: remove this function
     * @function loadContent
     * @description Reads the file content from disk.
     * @returns {Promise(String)} A Promis that resolves to a String representing the file content loaded from disk.
     * @memberof module:ProjetFile
     * @instance
     */
    Descriptor.prototype.loadContent = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            // sanity check
            _this.encoding = (_this.isImage(_this.name)) ? "base64" : "utf8";
            var token = {
                path: _this.path,
                encoding: _this.encoding
            };
            WSManager.getWebSocket().readFile(token, function (err, res) {
                if (err) {
                    reject(err);
                } else {
                    _this.content = res.content;
                    resolve(_this.content);
                }
            });
        });
    };
    
    
    
	module.exports = Descriptor;
});
