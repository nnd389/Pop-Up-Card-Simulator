/**
 * Created by amandaghassaei on 2/25/17.
 */

function initPattern(globals){

    var FOLD = require('fold');

    var foldData = {};
    var rawFold = {};

    function clearFold(){
        foldData.vertices_coords = [];
        foldData.v1ertices_assignments = [];
        foldData.edges_vertices = [];
        foldData.edges_assignment = [];//B = boundary, M = mountain, V = valley, C = cut, F = facet, U = hinge, G = glue
        foldData.edges_greenVal = []; // for determining glue matches, this is the g color value (integer) in rbg
        foldData.edges_foldAngle = [];//target angles
        delete foldData.vertices_vertices;
        delete foldData.faces_vertices;
        delete foldData.vertices_edges;
        rawFold = {};
    }

    var verticesRaw = [];
    var v1erticesAssignmentsRaw = [];
    //refs to vertex indices
    var mountainsRaw = [];
    var valleysRaw = [];
    var bordersRaw = [];
    var cutsRaw = [];
    var triangulationsRaw = [];
    var hingesRaw = [];
    var gluesRaw = [];

    var mountains = [];
    var valleys = [];
    var borders = [];
    var hinges = [];
    var triangulations = [];
    var glues = [];

    var badColors = [];//store any bad colors in svg file to show user
    var greenVals = [];
    var circleParams = [];

    function clearAll(){

        clearFold();
        verticesRaw = [];
        v1erticesAssignmentsRaw = [];

        mountainsRaw = [];
        valleysRaw = [];
        bordersRaw = [];
        cutsRaw = [];
        triangulationsRaw = [];
        hingesRaw = [];
        gluesRaw = [];

        mountains = [];
        valleys = [];
        borders = [];
        hinges = [];
        triangulations = [];
        glues = [];

        badColors = [];
        greenVals = [];
        circleParams = [];
    }

    clearAll();

    var SVGloader = new THREE.SVGLoader();

    //filter for svg parsing
    function borderFilter(){
        var stroke = getStroke($(this));
        return typeForStroke(stroke) == "border";
    }
    function mountainFilter(){
        var $this = $(this);
        var stroke = getStroke($this);
        if (typeForStroke(stroke) == "mountain"){
            var opacity = getOpacity($this);
            this.targetAngle = -opacity*180;
            return true;
        }
        return false;
    }
    function valleyFilter(){
        var $this = $(this);
        var stroke = getStroke($this);
        if (typeForStroke(stroke) == "valley"){
            var opacity = getOpacity($this);
            this.targetAngle = opacity*180;
            return true;
        }
        return false;
    }
    function cutFilter(){
        var stroke = getStroke($(this));
        return typeForStroke(stroke) == "cut";
    }
    function triangulationFilter(){
        var stroke = getStroke($(this));
        return typeForStroke(stroke) == "triangulation";
    }
    function hingeFilter(){
        var stroke = getStroke($(this));
        return typeForStroke(stroke) == "hinge";
    }
    //added a glue filter
    function glueFilter(){
        var stroke = getStroke($(this));
        return typeForStroke(stroke) == "glue";
    }

    function getOpacity(obj){
        // Check rendered style first (most browsers, supporting CSS styling),
        // then opacity attribute, then opacity:... spec in style attribute.
        // Ditto for stroke-opacity.  Both default to 1 (full opacity).
        // If both are present, they get multiplied together.
        var opacity = obj.css('opacity') || obj.attr('opacity') ||
            (obj[0].style && obj[0].style.opacity);
        var strokeOpacity = obj.css('stroke-opacity') ||
            obj.attr('stroke-opacity') ||
            (obj[0].style && obj[0].style.strokeOpacity);
        opacity = parseFloat(opacity);
        strokeOpacity = parseFloat(strokeOpacity);
        if (isNaN(opacity)) {
            opacity = 1;
        }
        if (isNaN(strokeOpacity)) {
            opacity = 1;
        }
        return opacity * strokeOpacity;
    }

    function getStroke(obj){
        // Check rendered style first (most browsers, supporting CSS styling),
        // then stroke attribute, then stroke:... spec in style attribute.
        var stroke = obj.css('stroke') || obj.attr("stroke") ||
            (obj[0].style && obj[0].style.stroke);
        if (stroke === undefined) {
            return null;
        }
        stroke = stroke.replace(/\s/g,'');//remove all whitespace
        return stroke.toLowerCase();
    }

    function typeForStroke(stroke){
        if (stroke == "#000000" || stroke == "#000" || stroke == "black" || stroke == "rgb(0,0,0)") return "border";
        if (stroke == "#ff0000" || stroke == "#f00" || stroke == "red" || stroke == "rgb(255,0,0)") return "mountain";
        if (stroke == "#0000ff" || stroke == "#00f" || stroke == "blue" || stroke == "rgb(0,0,255)") return "valley"; 
        if (stroke == "#00ff00" || stroke == "#0f0" || stroke == "green" || stroke == "rgb(0,255,0)") return "cut"; 
        if (stroke == "#ffff00" || stroke == "#ff0" || stroke == "yellow" || stroke == "rgb(255,255,0)") return "triangulation"; 
        if (stroke == "#ff00ff" || stroke == "#f0f" || stroke == "magenta" || stroke == "rgb(255,0,255)") return "hinge"; 
        //if (stroke == "#00ffff" || stroke == "#0ff" || stroke == "cyan" || stroke == "rgb(0,255,255)") return "glue";
        
        // Generalized RGB check for glue tabs
        if (stroke.startsWith("rgb(")){
            var match = stroke.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
            if (match) {
                const r = parseInt(match[1], 10);
                const g = parseInt(match[2], 10);
                const b = parseInt(match[3], 10);

                if (r==0 && b==255 && g>=1 && g<=255) {
                    return "glue"
                }
            }
        }
        // Generalized Hex Check (Full + shorthand)
        if (stroke.startsWith("#")){
            let hex = stroke.slice(1);
            if (hex.length === 3) { // for shorthand
                hex.hex.split("").map(ch => ch + ch).join(""); // e.g. turns f0a to ff00aa
            }
            if (/^[0-9a-fA-F]{6}$/.test(hex)){
                const r = parseInt(hex.slice(0,2), 16);
                const g = parseInt(hex.slice(2,4), 16);
                const b = parseInt(hex.slice(4,6), 16);

                if (r===0 && b===255 && g>=1 && g<=255){
                    return "glue"
                }
            }
        }

        badColors.push(stroke);
        return null;
    }

    function colorForAssignment(assignment){ // edit to also take in rgb value so it returns the correct color 
        if (assignment == "B") return "#000";//border
        if (assignment == "M") return "#f00";//mountain
        if (assignment == "V") return "#00f";//valley
        if (assignment == "C") return "#0f0";//cut
        if (assignment == "F") return "#ff0";//facet
        if (assignment == "U") return "#f0f";//hinge
        if (assignment == "G") return "#0ff";//glue tab
        if (assignment == "GS") return "#9900ffff";//glue spring
    
        //return "#0ff"
    }
    function opacityForAngle(angle, assignment){
        if (angle === null || assignment == "F") return 1;
        return Math.abs(angle)/180;
    }

    function findType(_verticesRaw, _v1erticesAssignmentsRaw, _segmentsRaw, filter, $paths, $lines, $rects, $polygons, $polylines, $circles){
        parsePath(_verticesRaw, _v1erticesAssignmentsRaw, _segmentsRaw, $paths.filter(filter));
        parseLine(_verticesRaw, _v1erticesAssignmentsRaw, _segmentsRaw, $lines.filter(filter));
        parseRect(_verticesRaw, _v1erticesAssignmentsRaw, _segmentsRaw, $rects.filter(filter));
        parsePolygon(_verticesRaw, _v1erticesAssignmentsRaw, _segmentsRaw, $polygons.filter(filter));
        parsePolyline(_verticesRaw, _v1erticesAssignmentsRaw, _segmentsRaw, $polylines.filter(filter));
    }

    // function parseRGB(rgbString) {
    //     const match = rgbString.match(/\d+/g);
    //     if (!match || match.length < 3) return null;

    //     return {
    //         r: Number(match[0]),
    //         g: Number(match[1]),
    //         b: Number(match[2]), 
    //         a: nums[3] !== undefined ? Number(nums[3]) : 1
    //     };
    // }

    function getCircleParams(_verticesRaw, _v1erticesAssignmentsRaw, $elements) {
        var _circleParams = [] // [cx, cy, radius, g]
        for (var i=0;i<$elements.length;i++){
            var element = $elements[i];

            //const cx = element.cx.baseVal.value; csometimes returns negative values??
            //const cy = element.cy.baseVal.value;
            const pt = element.ownerSVGElement.createSVGPoint();
            pt.x = element.cx.baseVal.value;
            pt.y = element.cy.baseVal.value;

            const screenPt = pt.matrixTransform(element.getCTM());

            const cx = screenPt.x;
            const cy = screenPt.y;

            const radius = element.r.baseVal.value;
            const fill = getComputedStyle(element).fill; // for some reason even when I have a filled circle this returns "none"
            const stroke = getComputedStyle(element).stroke; // stroke works!
            const [r, g, b] = stroke.match(/\d+/g).map(Number);

            _circleParams.push([cx, cy, radius, g]);
            console.log("We are insdie get Circle Params, (cx,cy): (", cx, ",", cy, ")")

            if (r==0 && b==255 && g>=1 && g<=255) {
                _verticesRaw.push({x:cx, y:0, z:cy});
                _v1erticesAssignmentsRaw.push(g);
            }
        }
        return _circleParams;
    }


    function applyTransformation(vertex, element){
        var transformations = [];
        var ancestor = element;
        do {
            if (ancestor.transform)
                transformations.push.apply(transformations, ancestor.transform.baseVal);
            ancestor = ancestor.parentNode;
        } while (ancestor && ancestor.nodeName !== 'svg');
        for (var i=0;i<transformations.length;i++){
            var t = transformations[i];
            var M = [[t.matrix.a, t.matrix.c, t.matrix.e], [t.matrix.b, t.matrix.d, t.matrix.f], [0,0,1]];
            var out = numeric.dot(M, [vertex.x, vertex.z, 1]);
            vertex.x = out[0];
            vertex.z = out[1];
        }
    }

    function parsePath(_verticesRaw, _v1erticesAssignmentsRaw, _segmentsRaw, $elements){
        var strokes = $elements.map(function() {
            return getStroke($(this));
        }).get();
        for (var i=0;i<$elements.length;i++){
            var path = $elements[i];
            var pathVertices = [];
            var stroke = strokes[i];
            if (path === undefined || path.getPathData === undefined){//mobile problem
                var elm = '<div id="coverImg" ' +
                  'style="background: url(assets/doc/crane.gif) no-repeat center center fixed;' +
                    '-webkit-background-size: cover;' +
                    '-moz-background-size: cover;' +
                    '-o-background-size: cover;' +
                    'background-size: cover;">'+
                  '</div>';
                $(elm).appendTo($("body"));
                $("#noSupportModal").modal("show");
                console.warn("path parser not supported");
                return;
            }
            var startVertex = null;
            var segments = path.getPathData();
            for (var j=0;j<segments.length;j++){
                var segment = segments[j];
                var type = segment.type;
                switch(type){

                    case "m"://dx, dy
                        var vertex;
                        if (j === 0){
                            // "If a relative moveto (m) appears as the first
                            // element of the path, then it is treated as a
                            // pair of absolute coordinates"
                            // [https://www.w3.org/TR/SVG/paths.html#PathDataMovetoCommands]
                            vertex = new THREE.Vector3(segment.values[0], 0, segment.values[1]);
                        } else {
                            vertex = _verticesRaw[_verticesRaw.length-1].clone();
                            vertex.x += segment.values[0];
                            vertex.z += segment.values[1];
                        }
                        startVertex = _verticesRaw.length;
                        _verticesRaw.push(vertex);
                        _v1erticesAssignmentsRaw.push(null);
                        pathVertices.push(vertex);
                        break;

                    case "l"://dx, dy
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length, stroke]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        var vertex = _verticesRaw[_verticesRaw.length-1].clone();
                        vertex.x += segment.values[0];
                        vertex.z += segment.values[1];
                        _verticesRaw.push(vertex);
                        _v1erticesAssignmentsRaw.push(null);
                        pathVertices.push(vertex);
                        break;

                    case "v"://dy
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length, stroke]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        var vertex = _verticesRaw[_verticesRaw.length-1].clone();
                        vertex.z += segment.values[0];
                        _verticesRaw.push(vertex);
                        _v1erticesAssignmentsRaw.push(null);
                        pathVertices.push(vertex);
                        break;

                    case "h"://dx
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length, stroke]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        var vertex = _verticesRaw[_verticesRaw.length-1].clone();
                        vertex.x += segment.values[0];
                        _verticesRaw.push(vertex);
                        _v1erticesAssignmentsRaw.push(null);
                        pathVertices.push(vertex);
                        break;

                    case "M"://x, y
                        var vertex = new THREE.Vector3(segment.values[0], 0, segment.values[1]);
                        startVertex = _verticesRaw.length;
                        _verticesRaw.push(vertex);
                        _v1erticesAssignmentsRaw.push(null);
                        pathVertices.push(vertex);
                        break;

                    case "L"://x, y
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length, stroke]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        var vertex = new THREE.Vector3(segment.values[0], 0, segment.values[1]);
                        _verticesRaw.push(vertex);
                        _v1erticesAssignmentsRaw.push(null);
                        pathVertices.push(vertex);
                        break;

                    case "V"://y
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length, stroke]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        var vertex = _verticesRaw[_verticesRaw.length-1].clone();
                        vertex.z = segment.values[0];
                        _verticesRaw.push(vertex);
                        _v1erticesAssignmentsRaw.push(null);
                        pathVertices.push(vertex);
                        break;

                    case "H"://x
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length, stroke]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        var vertex = _verticesRaw[_verticesRaw.length-1].clone();
                        vertex.x = segment.values[0];
                        _verticesRaw.push(vertex);
                        _v1erticesAssignmentsRaw.push(null);
                        pathVertices.push(vertex);
                        break;

                    case "z":
                    case "Z":
                        if (startVertex != null) {
                            _segmentsRaw.push([_verticesRaw.length-1, startVertex, stroke]);
                            startVertex = null;
                        }
                        break;
                }
            }
            for (var j=0;j<pathVertices.length;j++){
                applyTransformation(pathVertices[j], path);
            }
        }
    }


    function parseLine(_verticesRaw, _v1erticesAssignmentsRaw, _segmentsRaw, $elements){
        var strokes = $elements.map(function() {
            return getStroke($(this));
        }).get();// still a bit confused on how to call getstroke properly
        for (var i=0;i<$elements.length;i++){
            var stroke = strokes[i]
            var element = $elements[i];
            _verticesRaw.push(new THREE.Vector3(element.x1.baseVal.value, 0, element.y1.baseVal.value));
            _verticesRaw.push(new THREE.Vector3(element.x2.baseVal.value, 0, element.y2.baseVal.value));
            _v1erticesAssignmentsRaw.push(null);
            _v1erticesAssignmentsRaw.push(null);
            _segmentsRaw.push([_verticesRaw.length-2, _verticesRaw.length-1, stroke]);
            if (element.targetAngle) _segmentsRaw[_segmentsRaw.length-1].push(element.targetAngle);
            applyTransformation(_verticesRaw[_verticesRaw.length-2], element);
            applyTransformation(_verticesRaw[_verticesRaw.length-1], element);
        }
    }

    function parseRect(_verticesRaw, _v1erticesAssignmentsRaw, _segmentsRaw, $elements){
        var strokes = $elements.map(function() {
            return getStroke($(this));
        }).get();
        for (var i=0;i<$elements.length;i++){
            var stroke = strokes[i]
            var element = $elements[i];
            var x = element.x.baseVal.value;
            var y = element.y.baseVal.value;
            var width = element.width.baseVal.value;
            var height = element.height.baseVal.value;
            _verticesRaw.push(new THREE.Vector3(x, 0, y));
            _verticesRaw.push(new THREE.Vector3(x+width, 0, y));
            _verticesRaw.push(new THREE.Vector3(x+width, 0, y+height));
            _verticesRaw.push(new THREE.Vector3(x, 0, y+height));
            _v1erticesAssignmentsRaw.push(null);
            _v1erticesAssignmentsRaw.push(null);
            _v1erticesAssignmentsRaw.push(null);
            _v1erticesAssignmentsRaw.push(null);
            _segmentsRaw.push([_verticesRaw.length-4, _verticesRaw.length-3, stroke]);
            _segmentsRaw.push([_verticesRaw.length-3, _verticesRaw.length-2, stroke]);
            _segmentsRaw.push([_verticesRaw.length-2, _verticesRaw.length-1, stroke]);
            _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length-4, stroke]);
            for (var j=1;j<=4;j++){
                if (element.targetAngle) _segmentsRaw[_segmentsRaw.length-j].push(element.targetAngle);
                applyTransformation(_verticesRaw[_verticesRaw.length-j], element);
            }
        }
    }

    function parsePolygon(_verticesRaw, _v1erticesAssignmentsRaw, _segmentsRaw, $elements){
        var strokes = $elements.map(function() {
            return getStroke($(this));
        }).get();
        for (var i=0;i<$elements.length;i++){
            var stroke = strokes[i]
            var element = $elements[i];
            for (var j=0;j<element.points.length;j++){
                _verticesRaw.push(new THREE.Vector3(element.points[j].x, 0, element.points[j].y));
                _v1erticesAssignmentsRaw.push(null);
                applyTransformation(_verticesRaw[_verticesRaw.length-1], element);

                if (j<element.points.length-1) _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length, stroke]); // hopefully adding stroke here doesn't cause issues...
                else _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length-element.points.length, stroke]);

                if (element.targetAngle) _segmentsRaw[_segmentsRaw.length-1].push(element.targetAngle);
            }
        }
    }

    function parsePolyline(_verticesRaw, _v1erticesAssignmentsRaw, _segmentsRaw, $elements){
        var strokes = $elements.map(function() {
            return getStroke($(this));
        }).get();
        for (var i=0;i<$elements.length;i++){
            var stroke = strokes[i]
            var element = $elements[i];
            for (var j=0;j<element.points.length;j++){
                _verticesRaw.push(new THREE.Vector3(element.points[j].x, 0, element.points[j].y));
                _v1erticesAssignmentsRaw.push(null);
                applyTransformation(_verticesRaw[_verticesRaw.length-1], element);
                if (j>0) {
                    _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length-2, stroke]); // hopefully adding stroke here doesn't cause issues, I don't fully understand these inner for loops
                    if (element.targetAngle) _segmentsRaw[_segmentsRaw.length-1].push(element.targetAngle);
                }
            }
        }
    }


    function loadSVG(url, isDemo){
        if (isDemo) {
            gtag('event', 'demoFile', { 'CC': false });
        } else {
            gtag('event', 'uploadCP', { 'CC': false });
        }
        // Some SVG files start with UTF-8 byte order mark (BOM) EF BB BF,
        // which encodes in Base64 to 77u/ -- remove this, as it breaks the
        // XML/SVG parser.
        url = url.replace(/^(data:image\/svg\+xml;base64,)77u\//, '$1');

        SVGloader.load(url, function(svg){

            var _$svg = $(svg);
            if (_$svg.find('parsererror').length) {
                globals.warn("Error parsing SVG: " + svg.innerText);
                return console.warn(_$svg.find('parsererror')[0]);
            }

            // Add SVG to page dom to reveal rendered styles (including CSS).
            $(svg).appendTo('body');

            clearAll();

            //warn of groups
            // var $groups = _$svg.children("g");
            // if ($groups.length>0){
            //     globals.warn("Grouped elements found in SVG, these are currently ignored by the app.  " +
            //         "Please ungroup all elements before importing.");
            // }

            //format all appropriate svg elements
            _$svg.find("symbol").remove();
            _$svg.find("defs > :not(style)").remove();
            var $paths = _$svg.find("path");
            var $lines = _$svg.find("line");
            var $rects = _$svg.find("rect");
            var $polygons = _$svg.find("polygon");
            var $polylines = _$svg.find("polyline");
            var $circles = _$svg.find("circle");

            $paths.css({fill:"none", 'stroke-dasharray':"none"});
            $lines.css({fill:"none", 'stroke-dasharray':"none"});
            $rects.css({fill:"none", 'stroke-dasharray':"none"});
            $polygons.css({fill:"none", 'stroke-dasharray':"none"});
            $polylines.css({fill:"none", 'stroke-dasharray':"none"});
            $circles.css({ fill: "none", 'stroke-dasharray': "none" });
            console.log("Circle Info1:", $circles);

            

            findType(verticesRaw, v1erticesAssignmentsRaw, bordersRaw, borderFilter, $paths, $lines, $rects, $polygons, $polylines, $circles);
            findType(verticesRaw, v1erticesAssignmentsRaw, mountainsRaw, mountainFilter, $paths, $lines, $rects, $polygons, $polylines, $circles);
            findType(verticesRaw, v1erticesAssignmentsRaw, valleysRaw, valleyFilter, $paths, $lines, $rects, $polygons, $polylines, $circles);
            findType(verticesRaw, v1erticesAssignmentsRaw, cutsRaw, cutFilter, $paths, $lines, $rects, $polygons, $polylines, $circles);
            findType(verticesRaw, v1erticesAssignmentsRaw, triangulationsRaw, triangulationFilter, $paths, $lines, $rects, $polygons, $polylines, $circles);
            findType(verticesRaw, v1erticesAssignmentsRaw, hingesRaw, hingeFilter, $paths, $lines, $rects, $polygons, $polylines, $circles);
            findType(verticesRaw, v1erticesAssignmentsRaw, gluesRaw, glueFilter, $paths, $lines, $rects, $polygons, $polylines, $circles);

            circleParams = getCircleParams(verticesRaw, v1erticesAssignmentsRaw, $circles); // curved folding has parse ellipse as well
            console.log("Here is circleParams: ", circleParams)

            if (badColors.length>0){
                badColors = _.uniq(badColors);
                var string = "Some objects found with the following stroke colors:<br/><br/>";
                _.each(badColors, function(color){
                    string += "<span style='background:" + color + "' class='colorSwatch'></span>" + color + "<br/>";
                });
                string +=  "<br/>These objects were ignored.<br/>  Please check that your file is set up correctly, <br/>" +
                    "see <b>File > Design Tips</b> for more information.";
                globals.warn(string);
            }

            // Now that loading is done, remove SVG from page DOM.
            _$svg.remove();

            //todo revert back to old pattern if bad import
            var success = parseSVG(verticesRaw, v1erticesAssignmentsRaw, bordersRaw, mountainsRaw, valleysRaw, cutsRaw, triangulationsRaw, hingesRaw, gluesRaw);
            if (!success) return;
            generateSvg();
        },
        function(){},
        function(error){
            globals.warn("Error loading SVG " + url + " : " + error);
            console.warn(error);
        });
    }
    // I changed this to read folddata instead because I was interested in seeing all the yellow facet lines, and adding glue spring lines
    function generateSvg() {
        $("#svgViewer").empty();

        // find max and min vertices
        var max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        var min = new THREE.Vector3(Infinity, Infinity, Infinity);

        for (var i = 0; i < foldData.vertices_coords.length; i++) {
            var v = foldData.vertices_coords[i];
            var vertex = new THREE.Vector3(v[0], v[1], v[2]);
            max.max(vertex);
            min.min(vertex);
        }

        if (min.x === Infinity) {
            if (badColors.length == 0) globals.warn("no geometry found in file");
            return;
        }

        max.sub(min);
        var border = new THREE.Vector3(0.1, 0, 0.1);
        var scale = Math.max(max.x, max.y, max.z);
        if (scale == 0) return;

        var isCreasePattern =
            (foldData.frame_classes && foldData.frame_classes.includes('creasePattern')) ||
            max.y < scale / 100;

        if (!isCreasePattern) {
            console.log('Fold data is not a crease pattern, skipping SVG generation');
            return;
        }

        var strokeWidth = scale / 300;
        border.multiplyScalar(scale);
        min.sub(border);
        max.add(border.multiplyScalar(2));

        var viewBoxTxt = min.x + " " + min.z + " " + max.x + " " + max.z;

        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', viewBoxTxt);

        foldClone = structuredClone(foldData);

        // ---- draw edges ----
        for (var i = 0; i < foldData.edges_vertices.length; i++) {
            var line = document.createElementNS(ns, 'line');
            var edge = foldData.edges_vertices[i];

            var v1 = foldData.vertices_coords[edge[0]];
            var v2 = foldData.vertices_coords[edge[1]];
            
            var strokeColor = colorForAssignment(foldData.edges_assignment[i]);
            line.setAttribute('stroke', strokeColor);

            // // make dashed if special color
            // if (strokeColor === "#9900ffff") {
            //     line.setAttribute('stroke-dasharray', "5,5");
            // }

            line.setAttribute('opacity', opacityForAngle(
                foldData.edges_foldAngle[i],
                foldData.edges_assignment[i]
            ));

            line.setAttribute('x1', v1[0]);
            line.setAttribute('y1', v1[2]);
            line.setAttribute('x2', v2[0]);
            line.setAttribute('y2', v2[2]);
            line.setAttribute('stroke-width', strokeWidth);

            svg.appendChild(line);
        }

        // ---- draw vertex indices ----
        var fontSize = scale / 40;   // tweak as needed
        var textOffset = scale / 200;

        for (var i = 0; i < foldData.vertices_coords.length; i++) {
            var v = foldData.vertices_coords[i];

            var text = document.createElementNS(ns, 'text');
            text.textContent = i;

            text.setAttribute('x', v[0] + textOffset);
            text.setAttribute('y', v[2] - textOffset);
            text.setAttribute('font-size', fontSize);
            text.setAttribute('fill', '#000');
            text.setAttribute('pointer-events', 'none'); // prevents blocking clicks

            svg.appendChild(text);
        }

        $("#svgViewer").html(svg);
    }













    function cleanSegmentsRawForColor(segmentsRaw) {
        return segmentsRaw.map(seg => {
            const hasTarget = seg.length === 4;
            const [x, y, colorStr] = seg;
            const targetAngle = hasTarget ? seg[3] : undefined;

            let g = null; // default if parsing fails

            // --- 1. rgb(r,g,b) ---
            let match = colorStr.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
            if (match) {
                g = parseInt(match[2], 10);
                return hasTarget ? [x, y, g, targetAngle] : [x, y, g];
            }

            // --- 2. Full hex #RRGGBB ---
            match = colorStr.match(/^#([0-9A-Fa-f]{6})$/);
            if (match) {
                const hex = match[1];
                g = parseInt(hex.slice(2, 4), 16); // GG hex pair
                return hasTarget ? [x, y, g, targetAngle] : [x, y, g];
            }

            // --- 3. Shorthand hex #RGB ---
            match = colorStr.match(/^#([0-9A-Fa-f]{3})$/);
            if (match) {
                const hex = match[1];
                g = parseInt(hex[1] + hex[1], 16); // repeat G
                return hasTarget ? [x, y, g, targetAngle] : [x, y, g];
            }

            // --- 4. Unrecognized color format ---
            console.warn("Invalid color format:", colorStr);
            return hasTarget ? [x, y, null, targetAngle] : [x, y, null];
        });
    }


    function parseSVG(_verticesRaw, _v1erticesAssignmentsRaw, _bordersRaw, _mountainsRaw, _valleysRaw, _cutsRaw, _triangulationsRaw, _hingesRaw, _gluesRaw){
        // _segmentsRaw will have the form [node1, node2, color]
        // _valleysRaw and _mountainsRaw have the special form [node1, node2, color, targetAngle]

        _bordersRaw = cleanSegmentsRawForColor(_bordersRaw);
        _mountainsRaw = cleanSegmentsRawForColor(_mountainsRaw);
        _valleysRaw = cleanSegmentsRawForColor(_valleysRaw);
        _cutsRaw = cleanSegmentsRawForColor(_cutsRaw);
        _triangulationsRaw = cleanSegmentsRawForColor(_triangulationsRaw);
        _hingesRaw = cleanSegmentsRawForColor(_hingesRaw);
        _gluesRaw = cleanSegmentsRawForColor(_gluesRaw);

        _.each(_verticesRaw, function(vertex){
            foldData.vertices_coords.push([vertex.x, vertex.z]);
        });
        _.each(_v1erticesAssignmentsRaw, function(vertex){ 
            foldData.v1ertices_assignments.push(vertex);
        });
        _.each(_bordersRaw, function(edge){
            foldData.edges_vertices.push([edge[0], edge[1]]);
            foldData.edges_assignment.push("B");
            foldData.edges_greenVal.push(null); //FIX? I'm just using the color for glue tabs specifically, not sure if I will care about color of other edges
            foldData.edges_foldAngle.push(null);
        });
        _.each(_mountainsRaw, function(edge){
            foldData.edges_vertices.push([edge[0], edge[1]]);
            foldData.edges_assignment.push("M");
            foldData.edges_greenVal.push(null);
            foldData.edges_foldAngle.push(edge[3]); // I added color as an input of _segmentsRaw
        });
        _.each(_valleysRaw, function(edge){
            foldData.edges_vertices.push([edge[0], edge[1]]);
            foldData.edges_assignment.push("V");
            foldData.edges_greenVal.push(null);
            foldData.edges_foldAngle.push(edge[3]); // I added color as an input of _segmentsRaw
        });
        _.each(_triangulationsRaw, function(edge){
            foldData.edges_vertices.push([edge[0], edge[1]]);
            foldData.edges_assignment.push("F");
            foldData.edges_greenVal.push(null);
            foldData.edges_foldAngle.push(0);
        });
        _.each(_hingesRaw, function(edge){
            foldData.edges_vertices.push([edge[0], edge[1]]);
            foldData.edges_assignment.push("U");
            foldData.edges_greenVal.push(null);
            foldData.edges_foldAngle.push(null);
        });
        _.each(_cutsRaw, function(edge){
            foldData.edges_vertices.push([edge[0], edge[1]]);
            foldData.edges_assignment.push("C");
            foldData.edges_greenVal.push(null);
            foldData.edges_foldAngle.push(null);
        });
        _.each(_gluesRaw, function(edge){
            foldData.edges_vertices.push([edge[0], edge[1]]);
            foldData.edges_assignment.push("G");
            foldData.edges_greenVal.push(edge[2]); // this is correct! just make sure that segments raw looks nice before this
            foldData.edges_foldAngle.push(null);
        });
        




        if (foldData.vertices_coords.length == 0 || foldData.edges_vertices.length == 0){
            globals.warn("No valid geometry found in SVG, be sure to ungroup all and remove all clipping masks.");
            return false;
        }

        foldData = FOLD.filter.collapseNearbyVertices(foldData, globals.vertTol);
        foldData = FOLD.filter.removeLoopEdges(foldData);//remove edges that points to same vertex
        foldData = FOLD.filter.removeDuplicateEdges_vertices(foldData);//remove duplicate edges
        
        // foldData = FOLD.filter.subdivideCrossingEdges_vertices(foldData, globals.vertTol);//find intersections and add vertices/edges

        foldData = findIntersections(foldData, globals.vertTol); // FIX? this one specifically is splitting up the intersections
        //cleanup after intersection operation
        foldData = FOLD.filter.collapseNearbyVertices(foldData, globals.vertTol);
        foldData = FOLD.filter.removeLoopEdges(foldData);//remove edges that points to same vertex
        foldData = FOLD.filter.removeDuplicateEdges_vertices(foldData);//remove duplicate edges


        foldData = FOLD.convert.edges_vertices_to_vertices_vertices_unsorted(foldData);
        foldData = removeStrayVertices(foldData);//delete stray anchors
        foldData = removeRedundantVertices(foldData, 0.01);//remove vertices that split edge

        foldData.vertices_vertices = FOLD.convert.sort_vertices_vertices(foldData);
        foldData = FOLD.convert.vertices_vertices_to_faces_vertices(foldData);

        foldData = edgesVerticesToVerticesEdges(foldData);
        foldData = removeBorderFaces(foldData);//expose holes surrounded by all border edges

        foldData = reverseFaceOrder(foldData);//set faces to counter clockwise

        foldData = addGlueSprings(foldData); // add glue springs to folddata!
        // FIX: CONTINUE HERE: add GLue springs is adding things incorrectly somehow - there are lines crossing!!
        foldClone = structuredClone(foldData);
        console.log("Here is foldClone after adding Glue Springs: ", foldClone)


        return processFold(foldData);
    }



    function processFold(fold, returnCreaseParams, returnGlueParams, returnGlueDotParams){

        //add missing coordinates to make 3d, mapping (x,y) -> (x,0,z)
        //This is against the FOLD spec which says that, beyond two dimensions,
        //"all unspecified coordinates are implicitly zero"...
        var is2d = true;
        for (var i=0;i<fold.vertices_coords.length;i++){
            var vertex = fold.vertices_coords[i];
            if (vertex.length === 2) {
                fold.vertices_coords[i] = [vertex[0], 0, vertex[1]];
            } else {
                is2d = false;
            }
        }

        //save pre-triangulated faces for later saveFOLD()
        rawFold = JSON.parse(JSON.stringify(fold));

        var cuts = FOLD.filter.cutEdges(fold);
        if (cuts.length>0) {
            fold = splitCuts(fold);
            fold = FOLD.convert.edges_vertices_to_vertices_vertices_unsorted(fold);
            fold = removeRedundantVertices(fold, 0.01);//remove vertices that split edge
            // FIX uncomment above line
        }
        delete fold.vertices_vertices;
        delete fold.vertices_edges;  

        foldData = triangulatePolys(fold, is2d);

        mountains = FOLD.filter.mountainEdges(foldData);
        valleys = FOLD.filter.valleyEdges(foldData);
        borders = FOLD.filter.boundaryEdges(foldData);
        hinges = FOLD.filter.unassignedEdges(foldData);
        triangulations = FOLD.filter.flatEdges(foldData);
        glues = FOLD.filter.glueEdges(foldData);

        $("#numMtns").html("(" + mountains.length + ")");
        $("#numValleys").html("(" + valleys.length + ")");
        $("#numFacets").html("(" + triangulations.length + ")");
        $("#numBoundary").html("(" + borders.length + ")");
        $("#numPassive").html("(" + hinges.length + ")");
        $("#numGlues").html("(" + glues.length + ")");

        var allCreasesAndGlues = getFacesAndVerticesForEdges(foldData);//todo precompute vertices_faces
        fold = allCreasesAndGlues.fold
        var allCreaseParams = allCreasesAndGlues.allCreaseParams;
        var allGlueParams = allCreasesAndGlues.allGlueParams;
        var allGlueDotParams = allCreasesAndGlues.allGlueDotParams;

        if (returnCreaseParams) return allCreaseParams;
        if (returnGlueParams) return allGlueParams;
        if (returnGlueDotParams) return allGlueDotParams;

        globals.model.buildModel(foldData, allCreaseParams, allGlueParams, allGlueDotParams);

        return foldData;
    }

    function reverseFaceOrder(fold){
        for (var i=0;i<fold.faces_vertices.length;i++){
            fold.faces_vertices[i].reverse();
        }
        return fold;
    }

    function addGlueSprings(fold){ // FIX: this is copied from getFacesAndVerticesForEdges - need to delete glueparams stuff there
        // I'm adding glue edges to foldata instead of glueparams, delete glueparams
        
        foldClone = structuredClone(fold);
        console.log("Check 1: here is foldClone before adding any glue springs: ", foldClone)
        const originalEdgesLength = fold.edges_vertices.length; // hopefully this fixes any length changing issues
        var dim = fold.vertices_coords[0].length;

        for (var i=0;i<originalEdgesLength;i++){ // loop through all the edges, on edge i
            var assignmentI = fold.edges_assignment[i];
            var greenValI = fold.edges_greenVal[i];
            var edgeI = fold.edges_vertices[i];
            

            var x1 = fold.vertices_coords[edgeI[0]][0]; // this grabs the (x,y) coordinate the LEFT endpoint on edge I
            var y1 = fold.vertices_coords[edgeI[0]][dim-1]; 
            var x2 = fold.vertices_coords[edgeI[1]][0]; // this grabs the (x,y) coordinate the RIGHT endpoint on edge I (by left and right I mean edgeI[0] and edgeI[1])
            var y2 = fold.vertices_coords[edgeI[1]][dim-1]; 

            
            if (assignmentI == "G"){
                //FIX: need to fix directional issue later
                 var vTopInd = edgeI[0];
                 var vBottomInd = edgeI[1];
                 for (var j=0;j<originalEdgesLength;j++){ // loop through edges again, match edge i (outer loop) to edge j (this loop)
                    //FIX: I am ectively changing the length of fold.egdes_vertices.length, might want to change this
                    var edgeJ = fold.edges_vertices[j];
                    var vTopIndMatch = edgeJ[0];
                    var vBottomIndMatch = edgeJ[1];


                    // Temporary fix: make it so that glue springs don't cross, doesn't work for collinear glue tabs
                    var u1 = fold.vertices_coords[edgeJ[0]][0]; // this grabs the (x,y) coordinate the LEFT endpoint on edge J
                    var v1 = fold.vertices_coords[edgeJ[0]][dim-1]; 
                    var u2 = fold.vertices_coords[edgeJ[1]][0]; // this grabs the (x,y) coordinate the RIGHT endpoint on edge I (by left and right I mean edgeI[0] and edgeI[1])
                    var v2 = fold.vertices_coords[edgeJ[1]][dim-1]; 
                    
                    var m1 = (y1-v1)/(x1-u1);
                    var m2 = (y2-v2)/(x2-u2);
                    //console.log("(x1,y1): (", x1, ",", y1, ")   (x2,y2): (", x2, ",", y2, ")")
                    //console.log("(u1,v1): (", u1, ",", v1, ")   (u2,v2): (", u2, ",", v2, ")")
                    
                    var b1 = y1 - m1*x1;
                    var b2 = y2 - m2*x2;

                    // edge I has endpoints (x1, y1) and (x2, y2)
                    // edge J has endpoints (u1, v1) and (u2, v2)

                    var assignmentJ = fold.edges_assignment[j];
                    var greenValJ = fold.edges_greenVal[j];

                    if (assignmentJ=="G" && j!==i && greenValI==greenValJ){  
                        //console.log("m1: ", m1, "m2: ", m2)                       
                        if (m1 == Infinity){
                            console.warn("Found a vertical glue tab, setting slope to 1000. ")
                            m1 = 1000;
                        } else if (m2 == Infinity){
                            console.warn("Found a vertical glue tab, setting slope to 1000. ")
                            m2 = 1000;
                        }

                        // glue params = [nodeTopIndMatch, nodeTopInd, nodeBotIndMatch, nodeBotInd, edgeInd]
                        xInt = (b2-b1)/(m1-m2);
                        yInt = m1*xInt + b1;

                        xMin = Math.min(x1,x2,u1,u2);
                        xMax = Math.max(x1,x2,u1,u2);
                        yMin = Math.min(y1,y2,v1,v2);
                        yMax = Math.max(y1,y2,v1,v2);

                        //console.log("Testing a spring connecting vertices ", edgeI[1], " and ", edgeJ[0])
                        //console.log("Testing a spring connecting vertices ", edgeI[0], " and ", edgeJ[1])
                        //console.log("xMin: ", xMin, "xInt: ", xInt, "xMax: ", xMax)

                        // IT TOOK ME LIKE 2 HOURS TO FIGURE OUT I NEEDED TO CHANGE THE || TO AN &&
                        // I think it might still be off-- not sure yet but you might have to come back
                        // I want this if statement to cover if the x intercept is inside the little quadrilateral box, but it's not necessarily a rectangle
                        if ((xMin<xInt && xInt<xMax) && (yMin<yInt && yInt<yMax)){
                            //FIX: delete duplicates
                            fold.edges_assignment.push("GS");
                            fold.edges_assignment.push("GS");

                            fold.edges_foldAngle.push(null);
                            fold.edges_foldAngle.push(null);

                            fold.edges_greenVal.push(null);
                            fold.edges_greenVal.push(null);

                            fold.edges_vertices.push([vBottomIndMatch, vTopInd]);
                            fold.edges_vertices.push([vTopIndMatch, vBottomInd]);                            

                        } else{
                            //FIX: delete duplicates
                            fold.edges_assignment.push("GS");
                            fold.edges_assignment.push("GS");

                            fold.edges_foldAngle.push(null);
                            fold.edges_foldAngle.push(null);

                            fold.edges_greenVal.push(null);
                            fold.edges_greenVal.push(null);

                            fold.edges_vertices.push([vTopIndMatch, vTopInd]);
                            fold.edges_vertices.push([vBottomIndMatch, vBottomInd]);  
                        }
                    }
                }
            }
        }

        var circleSpringParams = []

        console.log("We are inside addGlue Springs, here is circle params: ", circleParams)
        for (var i=0;i<fold.vertices_coords.length;i++){
            var x = fold.vertices_coords[i][0];
            var y = fold.vertices_coords[i][dim-1];

            for (var j=0;j<circleParams.length;j++){
                var cx = circleParams[j][0];
                var cy = circleParams[j][1];
                var rad = circleParams[j][2];
                var g = circleParams[j][3];
                
                if (cx-rad<x && x<cx+rad && cy-rad<y && y<cy+rad){
                    console.log("highlighted vertex with g value: ", g, "at vertex: ", i)
                    circleSpringParams.push([i, g]);
                }
            }
        }

        console.log("Here is circle SPring Params: ", circleSpringParams)
        for (var i=0;i<circleSpringParams.length;i++){
            var gI = circleSpringParams[i][1];
            var vertI = circleSpringParams[i][0];
            for (var j=0;j<circleSpringParams.length;j++){
                var gJ = circleSpringParams[j][1];
                var vertJ = circleSpringParams[j][0];
                if (gI==gJ && i!=j){
                    console.log("we got a match!!")
                    fold.edges_assignment.push("GS");
                    fold.edges_foldAngle.push(null);
                    fold.edges_greenVal.push(null);
                    fold.edges_vertices.push([vertI,vertJ]); 
                }
            }

        }



        // need to comment out gluedotparams in model.js FIX

        return fold;
    }

    function edgesVerticesToVerticesEdges(fold){
        var verticesEdges = [];
        for (var i=0;i<fold.vertices_coords.length;i++){
            verticesEdges.push([]);
        }
        for (var i=0;i<fold.edges_vertices.length;i++){
            var edge = fold.edges_vertices[i];
            verticesEdges[edge[0]].push(i);
            verticesEdges[edge[1]].push(i);
        }
        fold.vertices_edges = verticesEdges;
        return fold;
    }

    function facesVerticesToVerticesFaces(fold){
        var verticesFaces = [];
        for (var i=0;i<fold.vertices_coords.length;i++){
            verticesFaces.push([]);
        }
        for (var i=0;i<fold.faces_vertices.length;i++){
            var face = fold.faces_vertices[i];
            for (var j=0;j<face.length;j++){
                verticesFaces[face[j]].push(i);
            }
        }
        fold.vertices_faces = verticesFaces;
        return fold;
    }

    function sortVerticesEdges(fold){
        for (var i=0;i<fold.vertices_vertices.length;i++){
            var verticesVertices = fold.vertices_vertices[i];
            var verticesEdges = fold.vertices_edges[i];
            var sortedVerticesEdges = [];
            for (var j=0;j<verticesVertices.length;j++){
                var index = -1;
                for (var k=0;k<verticesEdges.length;k++){
                    var edgeIndex = verticesEdges[k];
                    var edge = fold.edges_vertices[edgeIndex];
                    if (edge.indexOf(verticesVertices[j])>=0){
                        index = edgeIndex;
                        break;
                    }
                }
                if (index<0) console.warn("no matching edge found, fix this");
                sortedVerticesEdges.push(index);
            }
            fold.vertices_edges[i] = sortedVerticesEdges;
        }
        return fold;
    }

    // for cuts, vertices essentially belong to two different surfaces, so add vertex copies
    function splitCuts(fold){
        fold = sortVerticesEdges(fold);
        fold = facesVerticesToVerticesFaces(fold);
        //go around each vertex and split cut in clockwise order
        for (var i=0;i<fold.vertices_edges.length;i++){
            var groups = [[]];
            var groupIndex = 0;
            var verticesEdges = fold.vertices_edges[i];
            var verticesFaces = fold.vertices_faces[i];
            for (var j=0;j<verticesEdges.length;j++){
                var edgeIndex = verticesEdges[j];
                var assignment = fold.edges_assignment[edgeIndex];
                groups[groupIndex].push(edgeIndex);
                if (assignment == "C"){
                    //split cut edge into two boundary edges
                    groups.push([fold.edges_vertices.length]);
                    groupIndex++;
                    var newEdgeIndex = fold.edges_vertices.length;
                    var edge = fold.edges_vertices[edgeIndex];
                    fold.edges_vertices.push([edge[0], edge[1]]);
                    fold.edges_assignment[edgeIndex] = "B";
                    fold.edges_foldAngle.push(null);
                    fold.edges_assignment.push("B");
                    //add new boundary edge to other vertex
                    var otherVertex = edge[0];
                    if (otherVertex == i) otherVertex = edge[1];
                    var otherVertexEdges = fold.vertices_edges[otherVertex];
                    var otherVertexEdgeIndex = otherVertexEdges.indexOf(edgeIndex);
                    otherVertexEdges.splice(otherVertexEdgeIndex, 0, newEdgeIndex);
                } else if (assignment == "B"){
                    if (j==0 && verticesEdges.length>1){
                        //check if next edge is also boundary
                        var nextEdgeIndex = verticesEdges[1];
                        if (fold.edges_assignment[nextEdgeIndex] == "B"){
                            //check if this edge shares a face with the next
                            var edge = fold.edges_vertices[edgeIndex];
                            var otherVertex = edge[0];
                            if (otherVertex == i) otherVertex = edge[1];
                            var nextEdge = fold.edges_vertices[nextEdgeIndex];
                            var nextVertex  = nextEdge[0];
                            if (nextVertex == i) nextVertex = nextEdge[1];
                            if (connectedByFace(fold, fold.vertices_faces[i], otherVertex, nextVertex)){
                            } else {
                                groups.push([]);
                                groupIndex++;
                            }
                        }
                    } else if (groups[groupIndex].length>1) {
                        groups.push([]);
                        groupIndex++;
                    }
                }
            }
            if (groups.length <= 1) continue;
            for (var k=groups[groupIndex].length-1;k>=0;k--){//put remainder of last group in first group
                groups[0].unshift(groups[groupIndex][k]);
            }
            groups.pop();
            for (var j=1;j<groups.length;j++){//for each extra group, assign new vertex
                var currentVertex = fold.vertices_coords[i];
                var vertIndex = fold.vertices_coords.length;
                fold.vertices_coords.push(currentVertex.slice());//make a copy
                fold.v1ertices_assignments.push(null);
                var connectingIndices = [];
                for (var k=0;k<groups[j].length;k++){//update edges_vertices
                    var edgeIndex = groups[j][k];
                    var edge = fold.edges_vertices[edgeIndex];
                    var otherIndex = edge[0];
                    if (edge[0] == i) {
                        edge[0] = vertIndex;
                        otherIndex = edge[1];
                    } else edge[1] = vertIndex;
                    connectingIndices.push(otherIndex);
                }
                if (connectingIndices.length<2) {
                    console.warn("problem here");
                } else {
                    for (var k=1;k<connectingIndices.length;k++){//update faces_vertices
                        //i, k-1, k
                        var thisConnectingVertIndex = connectingIndices[k];
                        var previousConnectingVertIndex = connectingIndices[k-1];
                        var found = false;
                        for (var a=0;a<verticesFaces.length;a++){
                            var face = fold.faces_vertices[verticesFaces[a]];
                            var index1 = face.indexOf(thisConnectingVertIndex);
                            var index2 = face.indexOf(previousConnectingVertIndex);
                            var index3 = face.indexOf(i);
                            if (index1 >= 0 && index2 >= 0 && index3>=0 &&
                                (Math.abs(index1-index3) === 1 || Math.abs(index1-index3) === face.length-1) &&
                                (Math.abs(index2-index3) === 1 || Math.abs(index2-index3) === face.length-1)){
                                found = true;
                                face[index3] = vertIndex;
                                break;
                            }
                        }
                        if (!found) console.warn("problem here");
                    }
                }
            }
        }
        //these are all incorrect now
        delete fold.vertices_faces;
        delete fold.vertices_edges;
        delete fold.vertices_vertices;
        return fold;
    }

    function connectedByFace(fold, verticesFaces, vert1, vert2){
        if (vert1 == vert2) return false;
        for (var a=0;a<verticesFaces.length;a++){
            var face = fold.faces_vertices[verticesFaces[a]];
            if (face.indexOf(vert1) >= 0 && face.indexOf(vert2) >= 0){
                return true;
            }
        }
        return false;
    }

    function removeBorderFaces(fold){
        for (var i=fold.faces_vertices.length-1;i>=0;i--){
            var face = fold.faces_vertices[i];
            var allBorder = true;

            for (var j=0;j<face.length;j++){
                var vertexIndex = face[j];
                var nextIndex = j+1;
                if (nextIndex >= face.length) nextIndex = 0;
                var nextVertexIndex = face[nextIndex];
                var connectingEdgeFound = false;
                for (var k=0;k<fold.vertices_edges[vertexIndex].length;k++){
                    var edgeIndex = fold.vertices_edges[vertexIndex][k];
                    var edge = fold.edges_vertices[edgeIndex];
                    if ((edge[0] == vertexIndex && edge[1] == nextVertexIndex) ||
                        (edge[1] == vertexIndex && edge[0] == nextVertexIndex)){
                        connectingEdgeFound = true;
                        var assignment = fold.edges_assignment[edgeIndex];
                        if (assignment != "B"){
                            allBorder = false;
                            break;
                        }
                    }
                }
                if (!connectingEdgeFound) console.warn("no connecting edge found on face");
                if (!allBorder) break;
            }
            if (allBorder) fold.faces_vertices.splice(i,1);
        }
        return fold;
    }

    function getFacesAndVerticesForEdges(fold){
        var allCreaseParams = [];//face1Ind, vertInd, face2Ind, ver2Ind, edgeInd, angle
        var allGlueParams = []; //nodeTopIndMatch, nodeTopInd, nodeBotIndMatch, nodeBotInd, edgeInd, greenVal
        var allGlueDotParams = []; //nodeIndMatch, nodeInd, greenval
        var faces = fold.faces_vertices;

        for (var i=0;i<fold.edges_vertices.length;i++){ // loop through all the edges, on edge i
            var assignment = fold.edges_assignment[i];
            var greenValI = fold.edges_greenVal[i];
            var angle = fold.edges_foldAngle[i];
            var edgeI = fold.edges_vertices[i];

            var x1 = fold.vertices_coords[edgeI[0]][0]; // this grabs the (x,y) coordinate the LEFT endpoint on edge I
            var y1 = fold.vertices_coords[edgeI[0]][2]; 
            var x2 = fold.vertices_coords[edgeI[1]][0]; // this grabs the (x,y) coordinate the RIGHT endpoint on edge I (by left and right I mean edgeI[0] and edgeI[1])
            var y2 = fold.vertices_coords[edgeI[1]][2]; 

            //(angle === null && !globals.foldUseAngles) || (assignment !== "M" && assignment !== "V" && assignment !== "F")) continue;
            if (angle === null && !globals.foldUseAngles){
                console.log("FIX: Note to Nina, I thought that this was a case that would never show up, soooo I ignored it. Turns out it's important so I need you to go in and fix getFacesAndVerticesForEdges in pattern.js. Sorry!");
            }

            if (assignment == "M" || assignment == "V" || assignment == "F"){
                var v1 = edgeI[0];
                var v2 = edgeI[1];
                var creaseParams = [];
                if (assignment !== "M" || assignment !== "V" || assignment !== "F") {
                    for (var j=0;j<faces.length;j++){ // this goes through all the faces in order to find the correct crease faces!
                        var face = faces[j];
                        var faceVerts = [face[0], face[1], face[2]];
                        var v1Index = faceVerts.indexOf(v1);
                        if (v1Index>=0){
                            var v2Index = faceVerts.indexOf(v2);
                            if (v2Index>=0){
                                creaseParams.push(j);
                                if (v2Index>v1Index) {
                                    faceVerts.splice(v2Index, 1);
                                    faceVerts.splice(v1Index, 1);
                                } else {
                                    faceVerts.splice(v1Index, 1);
                                    faceVerts.splice(v2Index, 1);
                                }
                                creaseParams.push(faceVerts[0]);
                                if (creaseParams.length == 4) {

                                    if (v2Index-v1Index == 1 || v2Index-v1Index == -2) {
                                        creaseParams = [creaseParams[2], creaseParams[3], creaseParams[0], creaseParams[1]];
                                    }

                                    creaseParams.push(i);
                                    creaseParams.push(angle);
                                    allCreaseParams.push(creaseParams);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            if (assignment == "G"){
                //FIX: need to fix directional issue later
                
                 var vTopInd = edgeI[0];
                 var vBottomInd = edgeI[1];
                 var glueParams = [];
                 for (var j=0;j<fold.edges_vertices.length;j++){ // loop through edges again, match edge i (outer loop) to edge j (this loop)
                    var edgeJ = fold.edges_vertices[j];
                    var vTopIndMatch = edgeJ[0];
                    var vBottomIndMatch = edgeJ[1];
                    
                    // Temporary fix: make it so that glue springs don't cross, doesn't work for collinear glue tabs
                    var u1 = fold.vertices_coords[edgeJ[0]][0]; // this grabs the (x,y) coordinate the LEFT endpoint on edge J
                    var v1 = fold.vertices_coords[edgeJ[0]][2]; 
                    var u2 = fold.vertices_coords[edgeJ[1]][0]; // this grabs the (x,y) coordinate the RIGHT endpoint on edge I (by left and right I mean edgeI[0] and edgeI[1])
                    var v2 = fold.vertices_coords[edgeJ[1]][2]; 
                    
                    var m1 = (y1-v1)/(x1-u1);
                    var m2 = (y2-v2)/(x2-u2);
                    var b1 = y1 - m1*x1;
                    var b2 = y2 - m2*x2;

                    // edge I has endpoints (x1, y1) and (x2, y2)
                    // edge J has endpoints (u1, v1) and (u2, v2)

                    var assignmentJ = fold.edges_assignment[j];
                    var greenValJ = fold.edges_greenVal[j];

                    if (assignmentJ=="G" && j!==i && greenValI==greenValJ){ // add in &&j!==i
                        
                        if (m1 == Infinity){
                            console.warn("Found a vertical glue tab, setting slope to 1000. ")
                            m1 = 1000;
                        } else if (m2 == Infinity){
                            console.warn("Found a vertical glue tab, setting slope to 1000. ")
                            m2 = 1000;
                        }

                        // glue params = [nodeTopIndMatch, nodeTopInd, nodeBotIndMatch, nodeBotInd, edgeInd]
                        xInt = (b2-b1)/(m1-m2);
                        yInt = m1*xInt + b1;

                        xMin = Math.min(x1,x2,u1,u2);
                        xMax = Math.max(x1,x2,u1,u2);
                        yMin = Math.min(y1,y2,v1,v2);
                        yMax = Math.max(y1,y2,v1,v2);

                        if ((xMin<xInt && xInt<xMax) || (yMin<yInt && yInt<yMax)){
                            //FIX figure out how to switch the matches correctly oorahhhh
                            glueParams.push(vBottomIndMatch);
                            glueParams.push(vTopInd);
                            glueParams.push(vTopIndMatch);
                            glueParams.push(vBottomInd);
                            glueParams.push(i);
                            glueParams.push(fold.edges_greenVal[i])
                            allGlueParams.push(glueParams);
                        } else{
                            glueParams.push(vTopIndMatch);
                            glueParams.push(vTopInd);
                            glueParams.push(vBottomIndMatch);
                            glueParams.push(vBottomInd);
                            glueParams.push(i);
                            glueParams.push(fold.edges_greenVal[i])
                            allGlueParams.push(glueParams); //FIX before returning glue params I want you to delete duplicates, right now glue params is twice as long as it should be
                        }
                    }
                 }
            }
        }

        // now fill in gluedotparams
        //var allGlueDotParams = []; //nodeIndMatch, nodeInd, greenval
        for (var i=0;i<fold.v1ertices_assignments.length;i++){ // loop through all the vertices, vertex i
            var glueDotParams = [];
            var vertAssignmentI = fold.v1ertices_assignments[i];
            for (var j=0;j<fold.v1ertices_assignments.length;j++){ // vertex j
                var vertAssignmentJ = fold.v1ertices_assignments[j];

                if (vertAssignmentI==vertAssignmentJ && vertAssignmentI!=null && i!=j){
                    glueDotParams.push(j);
                    glueDotParams.push(i);
                    glueDotParams.push(vertAssignmentI);
                    allGlueDotParams.push(glueDotParams);
                }

            }
        }
       
        return {allCreaseParams, allGlueParams, allGlueDotParams, fold};
    }

    function removeRedundantVertices(fold, epsilon){

        var old2new = [];
        var numRedundant = 0;
        var newIndex = 0;
        for (var i=0;i<fold.vertices_vertices.length;i++){
            var vertex_vertices = fold.vertices_vertices[i];
            if (vertex_vertices.length != 2) {
                old2new.push(newIndex++);
                continue;
            }
            var vertex_coord = fold.vertices_coords[i];
            var neighbor0 = fold.vertices_coords[vertex_vertices[0]];
            var neighbor1 = fold.vertices_coords[vertex_vertices[1]];
            var threeD = vertex_coord.length == 3;
            var vec0 = [neighbor0[0]-vertex_coord[0], neighbor0[1]-vertex_coord[1]];
            var vec1 = [neighbor1[0]-vertex_coord[0], neighbor1[1]-vertex_coord[1]];
            var magSqVec0 = vec0[0]*vec0[0]+vec0[1]*vec0[1];
            var magSqVec1 = vec1[0]*vec1[0]+vec1[1]*vec1[1];
            var dot = vec0[0]*vec1[0]+vec0[1]*vec1[1];
            if (threeD){
                vec0.push(neighbor0[2]-vertex_coord[2]);
                vec1.push(neighbor1[2]-vertex_coord[2]);
                magSqVec0 += vec0[2]*vec0[2];
                magSqVec1 += vec1[2]*vec1[2];
                dot += vec0[2]*vec1[2];
            }
            dot /= Math.sqrt(magSqVec0*magSqVec1);
            if (Math.abs(dot + 1.0)<epsilon){
                var merged = mergeEdge(fold, vertex_vertices[0], i, vertex_vertices[1]);
                if (merged){
                    numRedundant++;
                    old2new.push(null);
                } else {
                    old2new.push(newIndex++);
                    continue;
                }
            } else old2new.push(newIndex++);
        }
        if (numRedundant == 0) return fold;
        console.warn(numRedundant + " redundant vertices found");
        fold = FOLD.filter.remapField(fold, 'vertices', old2new);
        if (fold.faces_vertices){
            for (var i=0;i<fold.faces_vertices.length;i++){
                var face = fold.faces_vertices[i];
                for (var j=face.length-1;j>=0;j--){
                    if (face[j] === null) face.splice(j, 1);
                }
            }
        }
        return fold;
    }

    function mergeEdge(fold, v1, v2, v3){//v2 is center vertex
        var angleAvg = 0;
        var avgSum = 0;
        var angles = [];
        var edgeAssignment = null;
        var edgeIndices = [];
        for (var i=fold.edges_vertices.length-1;i>=0;i--){
            var edge = fold.edges_vertices[i];
            if (edge.indexOf(v2)>=0 && (edge.indexOf(v1) >= 0 || edge.indexOf(v3) >= 0)){
                if (edgeAssignment === null) edgeAssignment = fold.edges_assignment[i];
                else if (edgeAssignment != fold.edges_assignment[i]) {
                    console.log(edgeAssignment, fold.edges_assignment[i]);
                    console.warn("different edge assignments");
                    return false;
                }
                var angle = fold.edges_foldAngle[i];
                if (isNaN(angle)) console.log(i);
                angles.push(angle);
                if (angle) {
                    angleAvg += angle;
                    avgSum++;
                }
                edgeIndices.push(i);//larger index in front
            }
        }
        if (angles[0] != angles[1]){
            console.warn("incompatible angles: " + JSON.stringify(angles));
        }
        for (var i=0;i<edgeIndices.length;i++){
            var index = edgeIndices[i];
            fold.edges_vertices.splice(index, 1);
            fold.edges_assignment.splice(index, 1);
            fold.edges_foldAngle.splice(index, 1);
        }
        fold.edges_vertices.push([v1, v3]);
        fold.edges_assignment.push(edgeAssignment);
        if (avgSum > 0) fold.edges_foldAngle.push(angleAvg/avgSum);
        else fold.edges_foldAngle.push(null);
        var index = fold.vertices_vertices[v1].indexOf(v2);
        fold.vertices_vertices[v1].splice(index, 1);
        fold.vertices_vertices[v1].push(v3);
        index = fold.vertices_vertices[v3].indexOf(v2);
        fold.vertices_vertices[v3].splice(index, 1);
        fold.vertices_vertices[v3].push(v1);
        return true;
    }

    function removeStrayVertices(fold){
        if (!fold.vertices_vertices) {
            console.warn("compute vertices_vertices first");
            fold = FOLD.convert.edges_vertices_to_vertices_vertices_unsorted(fold);
        }
        var numStrays = 0;
        var old2new = [];
        var newIndex = 0;
        for (var i=0;i<fold.vertices_vertices.length;i++){
            if (fold.vertices_vertices[i] === undefined || fold.vertices_vertices[i].length==0) {
                numStrays++;
                old2new.push(null);
            } else old2new.push(newIndex++);
        }
        if (numStrays == 0) return fold;
        console.warn(numStrays+ " stray vertices found");
        return FOLD.filter.remapField(fold, 'vertices', old2new);
    }

    function triangulatePolys(fold, is2d){
        var vertices = fold.vertices_coords;
        var faces = fold.faces_vertices;
        var edges = fold.edges_vertices;
        var foldAngles = fold.edges_foldAngle;
        var assignments = fold.edges_assignment;
        var greenVals = fold.edges_greenVal;
        var triangulatedFaces = [];
        for (var i=0;i<faces.length;i++){

            var face = faces[i];

            if (face.length == 3){
                triangulatedFaces.push(face);
                continue;
            }

            //check for quad and solve manually
            if (face.length == 4){
                var faceV1 = makeVector(vertices[face[0]]);
                var faceV2 = makeVector(vertices[face[1]]);
                var faceV3 = makeVector(vertices[face[2]]);
                var faceV4 = makeVector(vertices[face[3]]);
                var dist1 = (faceV1.clone().sub(faceV3)).lengthSq();
                var dist2 = (faceV2.clone().sub(faceV4)).lengthSq();
                if (dist2<dist1) {
                    edges.push([face[1], face[3]]);
                    foldAngles.push(0);
                    assignments.push("F");
                    greenVals.push(null);
                    triangulatedFaces.push([face[0], face[1], face[3]]);
                    triangulatedFaces.push([face[1], face[2], face[3]]);
                } else {
                    edges.push([face[0], face[2]]);
                    foldAngles.push(0);
                    assignments.push("F");
                    greenVals.push(null);
                    triangulatedFaces.push([face[0], face[1], face[2]]);
                    triangulatedFaces.push([face[0], face[2], face[3]]);
                }
                continue;
            }

            var faceEdges = [];
            for (var j=0;j<edges.length;j++){
                var edge = edges[j];
                if (face.indexOf(edge[0]) >= 0 && face.indexOf(edge[1]) >= 0){
                    faceEdges.push(j);
                }
            }

            var faceVert = [];
            var triangles = [];
            if (is2d) {
                for (var j=0;j<face.length;j++){
                    var vertex = vertices[face[j]];
                    faceVert.push(vertex[0]);
                    faceVert.push(vertex[2]);
                }
                triangles = earcut(faceVert, null, 2);
            } else {
                // earcut only uses the two first coordinates for triangulation...
                // as a fix, we try each of the dimension combinations until we get a result
                for (var j=2; j>=0; j--) {
                    faceVert = [];
                    for (var k=0;k<face.length;k++){
                        var vertex = vertices[face[k]];
                        faceVert.push(vertex[j]);
                        faceVert.push(vertex[(j + 1) % 3]);
                        faceVert.push(vertex[(j + 2) % 3]);
                    }
                    triangles = earcut(faceVert, null, 3);
                    // make sure we got *enough* triangle to cover the face
                    if (triangles.length >= 3 * (face.length - 2)) break;
                }
            }

            // triangles from earcut() can have backwards winding relative to original face
            // [https://github.com/mapbox/earcut/issues/44]
            // we look for the first edge of the original face among the triangles;
            // if it appears reversed in any triangle, we flip all triangles
            var needsFlip = null;
            for (var j=0;j<triangles.length;j+=3){
                for (var k=0; k<3; k++) {
                    if (triangles[j + k] === 0 && triangles[j + (k+1)%3] === 1) {
                        needsFlip = false;
                        break;
                    } else if (triangles[j + k] === 1 && triangles[j + (k+1)%3] === 0) {
                        needsFlip = true;
                        break;
                    }
                }
                if (needsFlip != null) break;
            }

            for (var j=0;j<triangles.length;j+=3){
                var tri;
                if (needsFlip) {
                    tri = [face[triangles[j+2]], face[triangles[j+1]], face[triangles[j]]];
                } else {
                    tri = [face[triangles[j]], face[triangles[j+1]], face[triangles[j+2]]];
                }
                var foundEdges = [false, false, false];//ab, bc, ca

                for (var k=0;k<faceEdges.length;k++){
                    var edge = edges[faceEdges[k]];

                    var aIndex = edge.indexOf(tri[0]);
                    var bIndex = edge.indexOf(tri[1]);
                    var cIndex = edge.indexOf(tri[2]);

                    if (aIndex >= 0){
                        if (bIndex >= 0) {
                            foundEdges[0] = true;
                            continue;
                        }
                        if (cIndex >= 0) {
                            foundEdges[2] = true;
                            continue;
                        }
                    }
                    if (bIndex >= 0){
                        if (cIndex >= 0) {
                            foundEdges[1] = true;
                            continue;
                        }
                    }
                }

                for (var k=0;k<3;k++){
                    if (foundEdges[k]) continue;
                    if (k==0){
                        faceEdges.push(edges.length);
                        edges.push([tri[0], tri[1]]);
                        foldAngles.push(0);
                        assignments.push("F");
                        greenVals.push(null);
                    } else if (k==1){
                        faceEdges.push(edges.length);
                        edges.push([tri[2], tri[1]]);
                        foldAngles.push(0);
                        assignments.push("F");
                        greenVals.push(null);
                    } else if (k==2){
                        faceEdges.push(edges.length);
                        edges.push([tri[2], tri[0]]);
                        foldAngles.push(0);
                        assignments.push("F");
                        greenVals.push(null);
                    }
                }

                triangulatedFaces.push(tri);
            }
        }
        fold.faces_vertices = triangulatedFaces;
        return fold;
    }

    function saveSVG(){
        
        if (globals.includeCurves) {
            globals.curvedFolding.saveSVG();
            return;
        }
        if (globals.noCreasePatternAvailable()){
            globals.warn("No crease pattern available.");
            return;
        }
        gtag('event', 'saveCP', { 'CC': false });
        var serializer = new XMLSerializer();
        var source = serializer.serializeToString($("#svgViewer>svg").get(0));
        var svgBlob = new Blob([source], {type:"image/svg+xml;charset=utf-8"});
        var svgUrl = URL.createObjectURL(svgBlob);
        var downloadLink = document.createElement("a");
        downloadLink.href = svgUrl;
        downloadLink.download =  globals.filename + ".svg";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    function findIntersections(fold, tol){
        var vertices = fold.vertices_coords;
        var edges = fold.edges_vertices;
        var foldAngles = fold.edges_foldAngle;
        var assignments = fold.edges_assignment;
        var colors = fold.edges_greenVal;
        for (var i=edges.length-1;i>=0;i--){
            for (var j=i-1;j>=0;j--){
                var v1 = makeVector2(vertices[edges[i][0]]);
                var v2 = makeVector2(vertices[edges[i][1]]);
                var v3 = makeVector2(vertices[edges[j][0]]);
                var v4 = makeVector2(vertices[edges[j][1]]);
                var data = line_intersect(v1, v2, v3, v4);
                if (data) {
                    var length1 = (v2.clone().sub(v1)).length();
                    var length2 = (v4.clone().sub(v3)).length();
                    var d1 = getDistFromEnd(data.t1, length1, tol);
                    var d2 = getDistFromEnd(data.t2, length2, tol);
                    if (d1 === null || d2 === null) continue;//no crossing

                    var seg1Int = d1>tol && d1<length1-tol;
                    var seg2Int = d2>tol && d2<length2-tol;
                    if (!seg1Int && !seg2Int) continue;//intersects at endpoints only

                    var vertIndex;
                    if (seg1Int && seg2Int){
                        vertIndex = vertices.length;
                        vertices.push([data.intersection.x,  data.intersection.y]);
                    } else if (seg1Int){
                        if (d2<=tol) vertIndex = edges[j][0];
                        else vertIndex = edges[j][1];
                    } else {
                        if (d1<=tol) vertIndex = edges[i][0];
                        else vertIndex = edges[i][1];
                    }

                    if (seg1Int){
                        var foldAngle = foldAngles[i];
                        var assignment = assignments[i];
                        var color = colors[i];
                        edges.splice(i, 1, [vertIndex, edges[i][0]], [vertIndex, edges[i][1]]);
                        foldAngles.splice(i, 1, foldAngle, foldAngle);
                        assignments.splice(i, 1, assignment, assignment);
                        colors.splice(i, 1, color, color);
                        i++;
                    }
                    if (seg2Int){
                        var foldAngle = foldAngles[j];
                        var assignment = assignments[j];
                        var color = colors[j];
                        edges.splice(j, 1, [vertIndex, edges[j][0]], [vertIndex, edges[j][1]]);
                        foldAngles.splice(j, 1, foldAngle, foldAngle);
                        assignments.splice(j, 1, assignment, assignment);
                        colors.splice(j, 1, color, color);
                        j++;
                        i++;
                    }
                }
            }
        }
        return fold;
    }

    function makeVector(v){
        if (v.length == 2) return makeVector2(v);
        return makeVector3(v);
    }
    function makeVector2(v){
        return new THREE.Vector2(v[0], v[1]);
    }
    function makeVector3(v){
        return new THREE.Vector3(v[0], v[1], v[2]);
    }

    function getDistFromEnd(t, length, tol){
        var dist = t*length;
        if (dist < -tol) return null;
        if (dist > length+tol) return null;
        return dist;
    }

    //http://paulbourke.net/geometry/pointlineplane/
    function line_intersect(v1, v2, v3, v4) {
        var x1 = v1.x;
        var y1 = v1.y;
        var x2 = v2.x;
        var y2 = v2.y;
        var x3 = v3.x;
        var y3 = v3.y;
        var x4 = v4.x;
        var y4 = v4.y;

        var ua, ub, denom = (y4 - y3)*(x2 - x1) - (x4 - x3)*(y2 - y1);
        if (denom == 0) {
            return null;
        }
        ua = ((x4 - x3)*(y1 - y3) - (y4 - y3)*(x1 - x3))/denom;
        ub = ((x2 - x1)*(y1 - y3) - (y2 - y1)*(x1 - x3))/denom;
        return {
            intersection: new THREE.Vector2(x1 + ua*(x2 - x1), y1 + ua*(y2 - y1)),
            t1: ua,
            t2: ub
        };
    }

    function getFoldData(raw){
        if (raw) return rawFold;
        return foldData;
    }

    function setFoldData(fold, isDemo, returnCreaseParams){
        if (!returnCreaseParams) {
            if (isDemo) {
                gtag('event', 'demoFile', { 'CC': false });
            } else {
                gtag('event', 'uploadCP', { 'CC': false });
            }
        }
        clearAll();
        var allCreaseParams = processFold(fold, returnCreaseParams);
        generateSvg();
        return allCreaseParams;
    }

    function getTriangulatedFaces(){
        return foldData.faces_vertices;
        
    }

// just for tracking
    // function printAllEdgesVerticesFaces() {
    // if (!foldData) {
    //     console.warn("No fold data available.");
    //     return;
    // }

    // console.log("=== Vertices ===");
    // foldData.vertices_coords.forEach((v, i) => {
    //     console.log(`Vertex ${i}: [${v.join(", ")}]`);
    // });

    // console.log("=== Edges ===");
    // foldData.edges_vertices.forEach((edge, i) => {
    //     const assignment = foldData.edges_assignment[i];
    //     const foldAngle = foldData.edges_foldAngle[i];
    //     console.log(`Edge ${i}: [${edge[0]}, ${edge[1]}], Type: ${assignment}, FoldAngle: ${foldAngle}`);
    // });

    // console.log("=== Faces ===");
    // foldData.faces_vertices.forEach((face, i) => {
    //     console.log(`Face ${i}: Vertices [${face.join(", ")}]`);
    // }); 

    // console.log(badColors);
    // }




    return {
        loadSVG: loadSVG,
        saveSVG: saveSVG,
        getFoldData: getFoldData,
        getTriangulatedFaces: getTriangulatedFaces,
        setFoldData: setFoldData
        // for Nina
        //printAllEdgesVerticesFaces: printAllEdgesVerticesFaces

    }
}
