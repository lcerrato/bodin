/**
 * BodinExternal
 * 
 * Plugin for retrieving and displaying external annotation bodies
 * Currently works only with CTS-enabled annotiation body URIs
 */
;(function( jQuery ) {
/**
     * Holds default config, adds user defined config, and initializes the plugin
     *
     * @param { obj } _elem The DOM element where the plugin will be drawn\
     * @param { obj } _config Key value pairs to hold the plugin's configuration
     * @param { string } _id The id of the DOM element
     */
    function BodinExternal( _elem, _config, _id ) {
        var self = this;
        self.elem = _elem;
        self.id = _id;
        self.init( _elem, _config );
    }
    
    /**
     * Holds default config, adds user defined config, and initializes the plugin
     *
     * @param { obj } _elem The DOM element where the plugin will be drawn
     * @param { obj } _config Key value pairs to hold the plugin's configuration
     *                        Expected: { xslt_path : path to transformation of annotation body xml,
     *                                    tokenizer : url to tokenizer service
     *                                   }
     */
    BodinExternal.prototype.init = function( _elem, _config ) {
       var self = this;
       
       //------------------------------------------------------------
       //    Mark your territory
       //------------------------------------------------------------
       jQuery( self.elem ).addClass('bodin-external');
       
       //------------------------------------------------------------
       //  Get the instance id
       //------------------------------------------------------------
       self.id = jQuery( self.elem ).attr('id');
       
       //------------------------------------------------------------
       //    User config 
       //------------------------------------------------------------
        self.config = $.extend({
        }, _config );
        
        //------------------------------------------------------------
        //    Events
        //------------------------------------------------------------
        self.events = {
            load: 'BodinExternal-LOADTEXT',
            load_done: 'BodinExternal-TEXTLOADED'
        };
        //------------------------------------------------------------
        //    Start event listeners
        //------------------------------------------------------------
        self.start();
    }
    
    /**
     * Start the interface
     * Loads the XSLT and sets up event listeners
     */
    BodinExternal.prototype.start = function() {
       var self = this;
       self.loadXslt(self.config.xslt_path);
       self.listen();
    }
    
    /**
     * Load XSLT
     * 
     * @param {string} _xsltPath path to XSLT file for
     *                 annotation transform
     */
    BodinExternal.prototype.loadXslt = function(_xsltPath) {
       var self = this;
       jQuery.ajax({
           dataType: "xml",
           url: _xsltPath,
           async: false
        }).done( 
            function(_data) {
                self.passageTransform = new XSLTProcessor();
                self.passageTransform.importStylesheet(_data);   
        }).fail(
            function(jqXHR, textStatus, errorThrown) { 
                var msg = "Can't get Passage XSLT";
                alert(msg);
                throw(msg);
            }
        );
    }
    
    /**
     * Listen for events
     * 
     * Adds a listener to load annotation text 
     */
    BodinExternal.prototype.listen = function() {
       var self=this;
       jQuery( window ).on( self.events.load, function( _e, _uri, _target, _motivation) {
           self.loadText( _e, _uri, _target, _motivation );
       });
    }
    
    /**
     * Load external annotation text
     * 
     * @param {event} _e the event
     * @param {string} _uri space-separated list of uris representing the annotation
     * @param {string} _target the identifier for the html element containing the target of the annotation
     * @param {string} _motivation the motivation for the annotation
     */
    BodinExternal.prototype.loadText = function(_e, _uri, _target, _motivation) {
       var self = this;
       var uris = _uri.split(/ /);
       var id = jQuery( self.elem );
       var tokenizer_url = self.config.tokenizer;
       
       //------------------------------------------------------------
       // for now, all annotations with multiple bodies must point
       // at the same base uri and just use multiple references for 
       // non-contiguous subref spans so we can just call get once
       // on the base uri 
       //------------------------------------------------------------
       var uri_no_subref = uris[0];
       var subref_index = uri_no_subref.indexOf('@');
       if (subref_index != -1) {
           uri_no_subref = uris[0].substr(0,subref_index);    
       }
       var bodin_align = new BodinAlign();
       var urn = bodin_align.getUrn(uris[0]);
       var subrefs = [];
       for (var i=0; i<uris.length; i++) {
           var subref = bodin_align.target(uris[i],urn);
           if (subref) {
               subrefs.push(subref);
           }
       }
       
       var request_url = tokenizer_url + encodeURIComponent(uri_no_subref);
       jQuery.get(request_url).done(
           function(_data) {
               if (self.passageTransform != null) {
                   if (subrefs.length > 0) {
                       self.passageTransform.setParameter(null,"e_cite",subrefs[0].cite);
                   }
                   var content = self.passageTransform.transformToDocument(_data);
                   if (content) {
                        var div = jQuery("div#tei_body",content);
                        if (div.length > 0) {
                           
                            var link_uri;
                            if (urn != '' && ! _uri.match(/^http:\/\/data\.perseus\.org/)) {
                                link_uri = 'http://data.perseus.org/';
                                if (subref) {
                                    link_uri = link_uri + 'citations/';
                                } else {
                                    link_uri = link_uri + 'texts/';
                                }
                                link_uri = link_uri + urn + ':' + subrefs[0].cite;
                            } else {
                                link_uri = _uri;
                            }
    
                            jQuery( self.elem ).html($(div).html()).
                                prepend('<div><a href="' + link_uri +'" target="_blank">' + link_uri + '</a></div>').
                                prepend('<h2>' + _motivation + '</h2>');
                            if (subref) {
                                bodin_align.mark(self.id,_target,subrefs,_motivation,null);
                            }
                        } else {
                            jQuery( self.elem ).html('<div class="error">Unable to transform the requested text.</div>')
                        }
                      } else {
                        jQuery( self.elem ).html(_data);
                    }
                } else {
                    jQuery( self.elem ).html(_data);
                }
                id.show();
              }).fail(
                function() {
                  jQuery( self.elem ).html('<div class="error">Unable to load the requested text.</div>');
                  id.show();
                }
              );
    }
          
    //----------------
    //    Extend JQuery 
    //----------------
    jQuery(document).ready( function( jQuery ) {
        jQuery.fn.BodinExternal = function( config ) {
            var id = jQuery(this).selector;
            return this.each( function() {
                jQuery.data( this, id, new BodinExternal( this, config, id ) );
            });
        };
    })
})(jQuery);