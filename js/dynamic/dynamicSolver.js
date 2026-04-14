/**
 * Created by ghassaei on 10/7/16.
 */

function initDynamicSolver(globals){
    //var spector = new SPECTOR.Spector();
    //spector.displayUI();
    //spector.spyCanvases();

    globals.gpuMath = initGPUMath();

    var nodes;
    var edges;
    var faces;
    var creases;
    var positions;
    var colors;
    var faceBarycenterGroup; //DELETE - for visualizing barycenters
    var faceBarycenterMeshes = []; //DELETE - for visualizing barycenters
    var faceBarycenterGeometry; //DELETE - for visualizing barycenters
    var faceBarycenterMaterial; //DELETE - for visualizing barycenters
    var worldPosition;

    var originalPosition;
    var position;
    var lastPosition;
    var lastLastPosition;//for verlet integration
    var velocity;
    var lastVelocity;
    var externalForces;
    var mass;
    var meta;  //[beamMetaIndex, numBeams, nodeCreaseMetaIndex, numCreases]
    var meta2; //[nodeFaceMetaIndex, numFaces, -, -]
    var meta3; //[nodeCollisionFaceMetaIndex, numCollFaces, facesAreHitMetaIndex, numFacesHit]
    //var meta4; //[beamCollisionMetaIndex, numBeams, -, -]
    var beamMeta;//[K, D, length, otherNodeIndex]
    //var beamCollisionMeta; // [ -, -, -, otherNodeIndex]

    var normals;
    var faceVertexIndices;//[a,b,c] textureDimFaces
    var nominalTriangles;//[angleA, angleB, angleC]
    var nodeFaceMeta;//[faceIndex, a, b, c] textureNodeFaces // List of faces each node is part of
    var nodeCollisionFaceMeta; //[faceIndex, a, b, c, u, v, w, d]      // List of faces each node is colliding with - use for adding collision forces to colliding nodes
    var facesAreHitMeta; // [faceIndex, -1, b, c, u, v, w, d] // List of faces each node is colliding with - used for adding collision forces to colliding faces
    var creaseMeta;//[k, d, targetTheta, -] textureDimCreases
    var creaseMeta2;//[node1Index, node2Index, node3index, node4index]//nodes 1 and 2 are opposite crease, 3 and 4 are on crease, textureDimCreases
    var nodeCreaseMeta;//[creaseIndex (thetaIndex), nodeIndex (1/2/3/4), -, -] textureDimNodeCreases
    var creaseGeo;//[h1, h2, coef1, coef2]
    var creaseVectors;//indices of crease nodes
    var theta;//[theta, w, normalIndex1, normalIndex2]
    var lastTheta;//[theta, w, normalIndex1, normalIndex2]

    function syncNodesAndEdges(){
        nodes = globals.model.getNodes();
        edges = globals.model.getEdges();
        faces = globals.model.getFaces();
        creases = globals.model.getCreases();

        positions = globals.model.getPositionsArray();
        colors = globals.model.getColorsArray();
        initFaceBarycenterRenderData(); //DELETE - for visualizing barycenters

        initTypedArrays();
        initTexturesAndPrograms(globals.gpuMath);
        setSolveParams();
    }

    var programsInited = false;//flag for initial setup

    var textureDim = 0;
    var textureDimEdges = 0;
    var textureDimFaces = 0;
    var textureDimCreases = 0;
    var textureDimNodeCreases = 0;
    var textureDimNodeFaces = 0;
    var textureDimNodeFaces2 = 0;
    var textureDimNodeCollisions = 0;

    function reset(){
        globals.gpuMath.step("zeroTexture", [], "u_position");
        globals.gpuMath.step("zeroTexture", [], "u_lastPosition");
        globals.gpuMath.step("zeroTexture", [], "u_lastLastPosition");
        globals.gpuMath.step("zeroTexture", [], "u_velocity");
        globals.gpuMath.step("zeroTexture", [], "u_lastVelocity");
        globals.gpuMath.step("zeroThetaTexture", ["u_lastTheta"], "u_theta");
        globals.gpuMath.step("zeroThetaTexture", ["u_theta"], "u_lastTheta");
        render();
    }

    function solve(_numSteps){

        if (globals.shouldAnimateFoldPercent){
            globals.creasePercent = globals.videoAnimator.nextFoldAngle(0);
            globals.controls.updateCreasePercent();
            setCreasePercent(globals.creasePercent);
            globals.shouldChangeCreasePercent = true;
        }

        if (globals.forceHasChanged) {
            updateExternalForces();
            globals.forceHasChanged = false;
        }
        if (globals.fixedHasChanged) {
            updateFixed();
            globals.fixedHasChanged = false;
        }
        if (globals.nodePositionHasChanged) {
            updateLastPosition();
            globals.nodePositionHasChanged = false;
        }
        if (globals.creaseMaterialHasChanged) {
            updateCreasesMeta();
            globals.creaseMaterialHasChanged = false;
        }
        if (globals.materialHasChanged) {
            updateMaterials();
            globals.materialHasChanged = false;
        }
        if (globals.shouldChangeCreasePercent) {
            setCreasePercent(globals.creasePercent);
            globals.shouldChangeCreasePercent = false;
        }

        if (collisionsEnabled) {
            [meta3, nodeCollisionFaceMeta, facesAreHitMeta] = getNodeFaceCollisionMeta(positions);
            // console.log("positions is: ", positions);
            // console.log("facevertexindices is: ", faceVertexIndices)
            // console.log("meta3 is: ", meta3);
            // console.log("nodecollisionfacemeta is: ", nodeCollisionFaceMeta);
            // console.log("facesarehitmeta is: ", facesAreHitMeta);
            

            globals.gpuMath.initTextureFromData("u_nodeCollisionFaceMeta", textureDimNodeCollisions, textureDimNodeCollisions, "FLOAT", nodeCollisionFaceMeta, true);
            globals.gpuMath.initTextureFromData("u_facesAreHitMeta", textureDimNodeFaces2, textureDimNodeFaces2, "FLOAT", facesAreHitMeta, true);
            globals.gpuMath.initTextureFromData("u_meta3", textureDim, textureDim, "FLOAT", meta3, true);
            globals.gpuMath.setUniformForProgram("collisionVelocityCalc", "u_meta3", 5, "1i");
            globals.gpuMath.setUniformForProgram("collisionVelocityCalc", "u_nodeCollisionFaceMeta", 7, "1i");
            globals.gpuMath.setUniformForProgram("collisionVelocityCalc", "u_facesAreHitMeta", 8, "1i"); 
        }





        // if (globals.shouldZeroDynamicVelocity){
        //     globals.gpuMath.step("zeroTexture", [], "u_velocity");
        //     globals.gpuMath.step("zeroTexture", [], "u_lastVelocity");
        //     globals.shouldZeroDynamicVelocity = false;
        // }
        if (globals.shouldCenterGeo){
            var avgPosition = getAvgPosition();
            globals.gpuMath.setProgram("centerTexture");
            globals.gpuMath.setUniformForProgram("centerTexture", "u_center", [avgPosition.x, avgPosition.y, avgPosition.z], "3f");
            globals.gpuMath.step("centerTexture", ["u_lastPosition"], "u_position");
            if (globals.integrationType == "verlet") globals.gpuMath.step("copyTexture", ["u_position"], "u_lastLastPosition");
            globals.gpuMath.swapTextures("u_position", "u_lastPosition");
            globals.gpuMath.step("zeroTexture", [], "u_lastVelocity");
            globals.gpuMath.step("zeroTexture", [], "u_velocity");
            globals.shouldCenterGeo = false;
        }

        if (_numSteps === undefined) _numSteps = globals.numSteps;

        for (var j=0;j<_numSteps;j++){
            solveStep();
        }
        render();
    }
    // this is the heart of the solver
    function solveStep(){

        var gpuMath = globals.gpuMath;

        gpuMath.setProgram("normalCalc");
        gpuMath.setSize(textureDimFaces, textureDimFaces);
        gpuMath.step("normalCalc", ["u_faceVertexIndices", "u_lastPosition", "u_originalPosition"], "u_normals");

        gpuMath.setProgram("thetaCalc");
        gpuMath.setSize(textureDimCreases, textureDimCreases);
        gpuMath.step("thetaCalc", ["u_normals", "u_lastTheta", "u_creaseVectors", "u_lastPosition",
            "u_originalPosition"], "u_theta");

        gpuMath.setProgram("updateCreaseGeo");
        //already at textureDimCreasesxtextureDimCreases
        gpuMath.step("updateCreaseGeo", ["u_lastPosition", "u_originalPosition", "u_creaseMeta2"], "u_creaseGeo");


        if (globals.integrationType == "verlet"){
            gpuMath.setProgram("positionCalcVerlet");
            gpuMath.setSize(textureDim, textureDim);
            gpuMath.step("positionCalcVerlet", ["u_lastPosition", "u_lastLastPosition", "u_lastVelocity", "u_originalPosition", "u_externalForces",
                "u_mass", "u_meta", "u_beamMeta", "u_creaseMeta", "u_nodeCreaseMeta", "u_normals", "u_theta", "u_creaseGeo",
                "u_meta2", "u_nodeFaceMeta", "u_nominalTriangles"], "u_position");
            gpuMath.step("velocityCalcVerlet", ["u_position", "u_lastPosition", "u_mass"], "u_velocity");
            gpuMath.swapTextures("u_lastPosition", "u_lastLastPosition");
        } else {//euler
            

            gpuMath.setProgram("velocityCalc");
            gpuMath.setSize(textureDim, textureDim);
            gpuMath.step("velocityCalc", ["u_lastPosition", "u_lastVelocity", "u_originalPosition", "u_externalForces",
                "u_mass", "u_meta", "u_beamMeta", "u_creaseMeta", "u_nodeCreaseMeta", "u_normals", "u_theta", "u_creaseGeo",
                "u_meta2", "u_nodeFaceMeta", "u_nominalTriangles"], "u_velocity");

            // don't forget to put all this in the verlet option as well
            if (collisionsEnabled) {

                //DELETE updatelastposition and delete the entire funciton updateworldposition
                //updateLastPosition();
                //updateWorldPosition();

                //CONTINUE HERE
                // I updated the form of nodecollisionfacemeta and facesarehitmeta (I should really update those names)
                // new form is documented on ipad
                // new technique is to calculate barcentric coords and P, and d on GPU directly (instead of passing it in)
                // this way all the needed variables are calculated using the most accurate positions possible

                // Dear Princess Celestia, 
                // today I learned that having the node and face index information can be collected and stored on the CPU,  
                // but all calculated values using positions that we want to apply forces with should occur on the GPU


                gpuMath.swapTextures("u_velocity", "u_lastVelocity");

                gpuMath.setProgram("collisionVelocityCalc");
                gpuMath.setSize(textureDim, textureDim);
                gpuMath.step("collisionVelocityCalc", ["u_lastPosition", "u_lastVelocity", "u_originalPosition", "u_externalForces", "u_mass", "u_meta3", "u_normals", "u_nodeCollisionFaceMeta", "u_facesAreHitMeta"], "u_velocity"); // FIX: add in "u_beamCollisionMeta" when ready

                //
                
                
                // FOR DEBUGGING ONLY
                if (meta3[3] > 0){

                    // DEBUG: read back u_velocity (RGBA = whatever shader wrote, e.g. u,v,w,d)
                    const vectorLength = 4;
                    gpuMath.setProgram("packToBytes");
                    gpuMath.setUniformForProgram("packToBytes", "u_vectorLength", vectorLength, "1f");
                    gpuMath.setUniformForProgram("packToBytes", "u_floatTextureDim", [textureDim, textureDim], "2f");
                    gpuMath.setSize(textureDim * vectorLength, textureDim);
                    gpuMath.step("packToBytes", ["u_velocity"], "outputBytes");

                    if (gpuMath.readyToRead()) {
                        const numPixels = nodes.length * vectorLength;
                        const height = Math.ceil(numPixels / (textureDim * vectorLength));
                        const pixels = new Uint8Array(height * textureDim * 4 * vectorLength);
                        gpuMath.readPixels(0, 0, textureDim * vectorLength, height, pixels);
                        const parsed = new Float32Array(pixels.buffer);

                        // print first few nodes
                        for (let i = 0; i < nodes.length; i++) {
                            console.log("u_velocity node", i, ": ", parsed[i*4], parsed[i*4 + 1], parsed[i*4 + 2], parsed[i*4 + 3]);
                        }
                        console.log("skip")
                    }
                }
                //DONE
                
                //gpuMath.swapTextures("u_velocity", "u_lastVelocity"); // if you put collisionvelocitycalc inbetween the other two neep to put swaptextures ontop
            }
            

            
            gpuMath.step("positionCalc", ["u_velocity", "u_lastPosition", "u_mass"], "u_position");
        }

        gpuMath.swapTextures("u_theta", "u_lastTheta");
        gpuMath.swapTextures("u_velocity", "u_lastVelocity");
        gpuMath.swapTextures("u_position", "u_lastPosition");





        // [meta3, nodeCollisionFaceMeta, facesAreHitMeta] = getNodeFaceCollisionMeta(positions);

        // globals.gpuMath.initTextureFromData("u_nodeCollisionFaceMeta", textureDimNodeCollisions, textureDimNodeCollisions, "FLOAT", nodeCollisionFaceMeta, true);
        // globals.gpuMath.initTextureFromData("u_facesAreHitMeta", textureDimNodeFaces2, textureDimNodeFaces2, "FLOAT", facesAreHitMeta, true);
        // globals.gpuMath.initTextureFromData("u_meta3", textureDim, textureDim, "FLOAT", meta3, true);
        // globals.gpuMath.setUniformForProgram("collisionVelocityCalc", "u_meta3", 5, "1i");
        // globals.gpuMath.setUniformForProgram("collisionVelocityCalc", "u_nodeCollisionFaceMeta", 7, "1i");
        // globals.gpuMath.setUniformForProgram("collisionVelocityCalc", "u_facesAreHitMeta", 8, "1i"); 
    }

    var $errorOutput = $("#globalError");

    function getAvgPosition(){
        var xavg = 0;
        var yavg = 0;
        var zavg = 0;
        for (var i=0;i<positions.length;i+=3){
            xavg += positions[i];
            yavg += positions[i+1];
            zavg += positions[i+2];
        }
        var avgPosition = new THREE.Vector3(xavg, yavg, zavg);
        avgPosition.multiplyScalar(3/positions.length);
        return avgPosition;
    }

    function render(){

        var vectorLength = 4;
        globals.gpuMath.setProgram("packToBytes");
        globals.gpuMath.setUniformForProgram("packToBytes", "u_vectorLength", vectorLength, "1f");
        globals.gpuMath.setUniformForProgram("packToBytes", "u_floatTextureDim", [textureDim, textureDim], "2f");
        globals.gpuMath.setSize(textureDim*vectorLength, textureDim);
        globals.gpuMath.step("packToBytes", ["u_lastPosition"], "outputBytes");

        if (globals.gpuMath.readyToRead()) {
            var numPixels = nodes.length*vectorLength;
            var height = Math.ceil(numPixels/(textureDim*vectorLength));
            var pixels = new Uint8Array(height*textureDim*4*vectorLength);
            globals.gpuMath.readPixels(0, 0, textureDim * vectorLength, height, pixels);
            var parsedPixels = new Float32Array(pixels.buffer);
            var globalError = 0;
            var shouldUpdateColors = globals.colorMode == "axialStrain";
            for (var i = 0; i < nodes.length; i++) {
                var rgbaIndex = i * vectorLength;
                var nodeError = parsedPixels[rgbaIndex+3]*100;
                globalError += nodeError;
                var nodePosition = new THREE.Vector3(parsedPixels[rgbaIndex], parsedPixels[rgbaIndex + 1], parsedPixels[rgbaIndex + 2]);
                nodePosition.add(nodes[i]._originalPosition);
                positions[3*i] = nodePosition.x;
                positions[3*i+1] = nodePosition.y;
                positions[3*i+2] = nodePosition.z;
                if (shouldUpdateColors){
                    if (nodeError>globals.strainClip) nodeError = globals.strainClip;
                    var scaledVal = (1-nodeError/globals.strainClip) * 0.7;
                    var color = new THREE.Color();
                    color.setHSL(scaledVal, 1, 0.5);
                    colors[3*i] = color.r;
                    colors[3*i+1] = color.g;
                    colors[3*i+2] = color.b;
                }
            }
            $errorOutput.html((globalError/nodes.length).toFixed(7) + " %");
            renderFaceBarycenters(); //DELETE - for visualizing barycenters
        } else {
            console.log("shouldn't be here");
        }
    }
//DELETE - for visualizing barycenters
    function initFaceBarycenterRenderData(){
        if (!faceBarycenterGroup){
            faceBarycenterGroup = new THREE.Object3D();
            globals.threeView.sceneAddModel(faceBarycenterGroup);
        }
        if (!faceBarycenterGeometry) faceBarycenterGeometry = new THREE.SphereGeometry(0.02, 8, 8);
        if (!faceBarycenterMaterial) faceBarycenterMaterial = new THREE.MeshBasicMaterial({color: 0x0c7bdc});
        while (faceBarycenterGroup.children.length > 0){
            faceBarycenterGroup.remove(faceBarycenterGroup.children[0]);
        }
        faceBarycenterMeshes = [];
        for (var i=0;i<faces.length;i++){
            var barycenterMesh = new THREE.Mesh(faceBarycenterGeometry, faceBarycenterMaterial);
            faceBarycenterGroup.add(barycenterMesh);
            faceBarycenterMeshes.push(barycenterMesh);
        }
    }

    function calculateFaceBarycentersFromPositions(currentPositions){
        var barycenters = [];
        for (var i=0;i<faces.length;i++){
            var face = faces[i];
            var nodeAIndex = 3*face[0];
            var nodeBIndex = 3*face[1];
            var nodeCIndex = 3*face[2];
            barycenters.push(new THREE.Vector3(
                (currentPositions[nodeAIndex] + currentPositions[nodeBIndex] + currentPositions[nodeCIndex])/3,
                (currentPositions[nodeAIndex+1] + currentPositions[nodeBIndex+1] + currentPositions[nodeCIndex+1])/3,
                (currentPositions[nodeAIndex+2] + currentPositions[nodeBIndex+2] + currentPositions[nodeCIndex+2])/3
            ));

        }
        return barycenters;
    }

    function renderFaceBarycenters(){
        if (!faceBarycenterGroup || faceBarycenterMeshes.length !== faces.length) initFaceBarycenterRenderData();
        var barycenters = calculateFaceBarycentersFromPositions(positions);
        for (var i=0;i<barycenters.length;i++){
            faceBarycenterMeshes[i].position.copy(barycenters[i]);
        }
    }

    function setFaceBarycentersVisibility(visible){
        globals.showFaceBarycenters = visible;
        if (faceBarycenterGroup) faceBarycenterGroup.visible = visible;
    }
    //DELETE - for visualizing barycenters^


    

    function setSolveParams(){
        var dt = calcDt();
        $("#deltaT").html(dt);
        globals.gpuMath.setProgram("thetaCalc");
        globals.gpuMath.setUniformForProgram("thetaCalc", "u_dt", dt, "1f");
        globals.gpuMath.setProgram("velocityCalc");
        globals.gpuMath.setUniformForProgram("velocityCalc", "u_dt", dt, "1f");
        globals.gpuMath.setProgram("positionCalcVerlet");
        globals.gpuMath.setUniformForProgram("positionCalcVerlet", "u_dt", dt, "1f");
        globals.gpuMath.setProgram("positionCalc");
        globals.gpuMath.setUniformForProgram("positionCalc", "u_dt", dt, "1f");
        globals.gpuMath.setProgram("collisionVelocityCalc");
        globals.gpuMath.setUniformForProgram("collisionVelocityCalc", "u_dt", dt, "1f");
        globals.gpuMath.setProgram("velocityCalcVerlet");
        globals.gpuMath.setUniformForProgram("velocityCalcVerlet", "u_dt", dt, "1f");
        globals.controls.setDeltaT(dt);
    }

    function calcDt(){
        var maxFreqNat = 0;
        _.each(edges, function(beam){
            if (beam.getNaturalFrequency()>maxFreqNat) maxFreqNat = beam.getNaturalFrequency();
        });
        return (1/(2*Math.PI*maxFreqNat))*0.9;//0.9 of max delta t for good measure
    }

    function initTexturesAndPrograms(gpuMath){

        var vertexShader = document.getElementById("vertexShader").text;
        gpuMath.initTextureFromData("u_position", textureDim, textureDim, "FLOAT", position, true);
        gpuMath.initTextureFromData("u_lastPosition", textureDim, textureDim, "FLOAT", lastPosition, true);
        gpuMath.initTextureFromData("u_lastLastPosition", textureDim, textureDim, "FLOAT", lastLastPosition, true);
        gpuMath.initTextureFromData("u_velocity", textureDim, textureDim, "FLOAT", velocity, true);
        gpuMath.initTextureFromData("u_lastVelocity", textureDim, textureDim, "FLOAT", lastVelocity, true);
        gpuMath.initTextureFromData("u_theta", textureDimCreases, textureDimCreases, "FLOAT", theta, true);
        gpuMath.initTextureFromData("u_lastTheta", textureDimCreases, textureDimCreases, "FLOAT", lastTheta, true);
        gpuMath.initTextureFromData("u_normals", textureDimFaces, textureDimFaces, "FLOAT", normals, true);

        gpuMath.initFrameBufferForTexture("u_position", true);
        gpuMath.initFrameBufferForTexture("u_lastPosition", true);
        gpuMath.initFrameBufferForTexture("u_lastLastPosition", true);
        gpuMath.initFrameBufferForTexture("u_velocity", true);
        gpuMath.initFrameBufferForTexture("u_lastVelocity", true);
        gpuMath.initFrameBufferForTexture("u_theta", true);
        gpuMath.initFrameBufferForTexture("u_lastTheta", true);
        gpuMath.initFrameBufferForTexture("u_normals", true);

        gpuMath.initTextureFromData("u_meta", textureDim, textureDim, "FLOAT", meta, true);
        gpuMath.initTextureFromData("u_meta2", textureDim, textureDim, "FLOAT", meta2, true);
        gpuMath.initTextureFromData("u_meta3", textureDim, textureDim, "FLOAT", meta3, true);
        gpuMath.initTextureFromData("u_nodeCreaseMeta", textureDimNodeCreases, textureDimNodeCreases, "FLOAT", nodeCreaseMeta, true);
        gpuMath.initTextureFromData("u_creaseMeta2", textureDimCreases, textureDimCreases, "FLOAT", creaseMeta2, true);
        gpuMath.initTextureFromData("u_nodeFaceMeta", textureDimNodeFaces, textureDimNodeFaces, "FLOAT", nodeFaceMeta, true);
        gpuMath.initTextureFromData("u_creaseGeo", textureDimCreases, textureDimCreases, "FLOAT", creaseGeo, true);
        gpuMath.initFrameBufferForTexture("u_creaseGeo", true);
        gpuMath.initTextureFromData("u_faceVertexIndices", textureDimFaces, textureDimFaces, "FLOAT", faceVertexIndices, true);
        gpuMath.initTextureFromData("u_nominalTriangles", textureDimFaces, textureDimFaces, "FLOAT", nominalTriangles, true);
        //CHCK: what are the width and height of these?
        gpuMath.initTextureFromData("u_nodeCollisionFaceMeta", textureDimNodeCollisions, textureDimNodeCollisions, "FLOAT", nodeCollisionFaceMeta, true);
        gpuMath.initTextureFromData("u_facesAreHitMeta", textureDimNodeFaces2, textureDimNodeFaces2, "FLOAT", facesAreHitMeta, true);

        gpuMath.createProgram("positionCalc", vertexShader, document.getElementById("positionCalcShader").text);
        gpuMath.setUniformForProgram("positionCalc", "u_velocity", 0, "1i");
        gpuMath.setUniformForProgram("positionCalc", "u_lastPosition", 1, "1i");
        gpuMath.setUniformForProgram("positionCalc", "u_mass", 2, "1i");
        gpuMath.setUniformForProgram("positionCalc", "u_textureDim", [textureDim, textureDim], "2f");

        gpuMath.createProgram("collisionVelocityCalc", vertexShader, document.getElementById("collisionVelocityCalcShader").text);
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_lastPosition", 0, "1i");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_lastVelocity", 1, "1i");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_originalPosition", 2, "1i");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_externalForces", 3, "1i");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_mass", 4, "1i");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_meta3", 5, "1i");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_normals", 6, "1i");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_nodeCollisionFaceMeta", 7, "1i");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_facesAreHitMeta", 8, "1i");
        //gpuMath.setUniformForProgram("collisionVelocityCalc", "u_beamCollisionMeta", 9, "1i");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_textureDimNodeCollisions", [textureDimNodeCollisions, textureDimNodeCollisions], "2f");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_textureDimNodeFaces", [textureDimNodeFaces, textureDimNodeFaces], "2f");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_textureDimNodeFaces2", [textureDimNodeFaces2, textureDimNodeFaces2], "2f");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_textureDimFaces", [textureDimFaces, textureDimFaces], "2f");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_nodeCollisionStiffness", globals.nodeCollisionStiffness, "1f");
        gpuMath.setUniformForProgram("collisionVelocityCalc", "u_nodeCollisionDMax", globals.nodeCollisionDMax, "1f");

        gpuMath.createProgram("velocityCalcVerlet", vertexShader, document.getElementById("velocityCalcVerletShader").text);
        gpuMath.setUniformForProgram("velocityCalcVerlet", "u_position", 0, "1i");
        gpuMath.setUniformForProgram("velocityCalcVerlet", "u_lastPosition", 1, "1i");
        gpuMath.setUniformForProgram("velocityCalcVerlet", "u_mass", 2, "1i");
        gpuMath.setUniformForProgram("velocityCalcVerlet", "u_textureDim", [textureDim, textureDim], "2f");

        gpuMath.createProgram("velocityCalc", vertexShader, document.getElementById("velocityCalcShader").text);
        gpuMath.setUniformForProgram("velocityCalc", "u_lastPosition", 0, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_lastVelocity", 1, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_originalPosition", 2, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_externalForces", 3, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_mass", 4, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_meta", 5, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_beamMeta", 6, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_creaseMeta", 7, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_nodeCreaseMeta", 8, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_normals", 9, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_theta", 10, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_creaseGeo", 11, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_meta2", 12, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_nodeFaceMeta", 13, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_nominalTriangles", 14, "1i");

        gpuMath.setUniformForProgram("velocityCalc", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDimEdges", [textureDimEdges, textureDimEdges], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDimFaces", [textureDimFaces, textureDimFaces], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDimCreases", [textureDimCreases, textureDimCreases], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDimNodeCreases", [textureDimNodeCreases, textureDimNodeCreases], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDimNodeFaces", [textureDimNodeFaces, textureDimNodeFaces], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_creasePercent", globals.creasePercent, "1f");
        gpuMath.setUniformForProgram("velocityCalc", "u_axialStiffness", globals.axialStiffness, "1f");
        gpuMath.setUniformForProgram("velocityCalc", "u_faceStiffness", globals.faceStiffness, "1f");
        gpuMath.setUniformForProgram("velocityCalc", "u_calcFaceStrain", globals.calcFaceStrain, "1f");

        gpuMath.createProgram("positionCalcVerlet", vertexShader, document.getElementById("positionCalcVerletShader").text);
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_lastPosition", 0, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_lastLastPosition", 1, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_lastVelocity", 2, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_originalPosition", 3, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_externalForces", 4, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_mass", 5, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_meta", 6, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_beamMeta", 7, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_creaseMeta", 8, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_nodeCreaseMeta", 9, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_normals", 10, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_theta", 11, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_creaseGeo", 12, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_meta2", 13, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_nodeFaceMeta", 14, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_nominalTriangles", 15, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDimEdges", [textureDimEdges, textureDimEdges], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDimFaces", [textureDimFaces, textureDimFaces], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDimCreases", [textureDimCreases, textureDimCreases], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDimNodeCreases", [textureDimNodeCreases, textureDimNodeCreases], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDimNodeFaces", [textureDimNodeFaces, textureDimNodeFaces], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_creasePercent", globals.creasePercent, "1f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_axialStiffness", globals.axialStiffness, "1f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_faceStiffness", globals.faceStiffness, "1f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_calcFaceStrain", globals.calcFaceStrain, "1f");

        gpuMath.createProgram("thetaCalc", vertexShader, document.getElementById("thetaCalcShader").text);
        gpuMath.setUniformForProgram("thetaCalc", "u_normals", 0, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_lastTheta", 1, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_creaseVectors", 2, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_lastPosition", 3, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_originalPosition", 4, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("thetaCalc", "u_textureDimFaces", [textureDimFaces, textureDimFaces], "2f");
        gpuMath.setUniformForProgram("thetaCalc", "u_textureDimCreases", [textureDimCreases, textureDimCreases], "2f");

        gpuMath.createProgram("normalCalc", vertexShader, document.getElementById("normalCalc").text);
        gpuMath.setUniformForProgram("normalCalc", "u_faceVertexIndices", 0, "1i");
        gpuMath.setUniformForProgram("normalCalc", "u_lastPosition", 1, "1i");
        gpuMath.setUniformForProgram("normalCalc", "u_originalPosition", 2, "1i");
        gpuMath.setUniformForProgram("normalCalc", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("normalCalc", "u_textureDimFaces", [textureDimFaces, textureDimFaces], "2f");

        gpuMath.createProgram("packToBytes", vertexShader, document.getElementById("packToBytesShader").text);
        gpuMath.initTextureFromData("outputBytes", textureDim*4, textureDim, "UNSIGNED_BYTE", null, true);
        gpuMath.initFrameBufferForTexture("outputBytes", true);
        gpuMath.setUniformForProgram("packToBytes", "u_floatTextureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("packToBytes", "u_floatTexture", 0, "1i");

        gpuMath.createProgram("zeroTexture", vertexShader, document.getElementById("zeroTexture").text);
        gpuMath.createProgram("zeroThetaTexture", vertexShader, document.getElementById("zeroThetaTexture").text);
        gpuMath.setUniformForProgram("zeroThetaTexture", "u_theta", 0, "1i");
        gpuMath.setUniformForProgram("zeroThetaTexture", "u_textureDimCreases", [textureDimCreases, textureDimCreases], "2f");

        gpuMath.createProgram("centerTexture", vertexShader, document.getElementById("centerTexture").text);
        gpuMath.setUniformForProgram("centerTexture", "u_lastPosition", 0, "1i");
        gpuMath.setUniformForProgram("centerTexture", "u_textureDim", [textureDim, textureDim], "2f");

        gpuMath.createProgram("copyTexture", vertexShader, document.getElementById("copyTexture").text);
        gpuMath.setUniformForProgram("copyTexture", "u_orig", 0, "1i");
        gpuMath.setUniformForProgram("copyTexture", "u_textureDim", [textureDim, textureDim], "2f");

        gpuMath.createProgram("updateCreaseGeo", vertexShader, document.getElementById("updateCreaseGeo").text);
        gpuMath.setUniformForProgram("updateCreaseGeo", "u_lastPosition", 0, "1i");
        gpuMath.setUniformForProgram("updateCreaseGeo", "u_originalPosition", 1, "1i");
        gpuMath.setUniformForProgram("updateCreaseGeo", "u_creaseMeta2", 2, "1i");
        gpuMath.setUniformForProgram("updateCreaseGeo", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("updateCreaseGeo", "u_textureDimCreases", [textureDimCreases, textureDimCreases], "2f");

        gpuMath.setSize(textureDim, textureDim);

        programsInited = true;
    }

    function calcTextureSize(numNodes){
        if (numNodes == 1) return 2;
        for (var i=0;i<numNodes;i++){
            if (Math.pow(2, 2*i) >= numNodes){
                return Math.pow(2, i);
            }
        }
        console.warn("no texture size found for " + numNodes + " items");
        return 2;
    }

    function updateMaterials(initing){
        var index = 0;
        for (var i=0;i<nodes.length;i++){
            if (initing) {
                meta[4*i] = index;
                meta[4*i+1] = nodes[i].numBeams();
            }
            for (var j=0;j<nodes[i].beams.length;j++){
                var beam = nodes[i].beams[j];
                var beam_assignment = beam.type;
                beamMeta[4*index] = beam.getK(beam_assignment);
                beamMeta[4*index+1] = beam.getD();
                if (initing) {
                    beamMeta[4*index+2] = beam.getLength(beam_assignment);
                    beamMeta[4*index+3] = beam.getOtherNode(nodes[i]).getIndex();
                }
                index+=1;
            }
        }

        globals.gpuMath.initTextureFromData("u_beamMeta", textureDimEdges, textureDimEdges, "FLOAT", beamMeta, true);

        if (programsInited) {
            globals.gpuMath.setProgram("collisionVelocityCalc");
            globals.gpuMath.setUniformForProgram("collisionVelocityCalc", "u_nodeCollisionStiffness", globals.nodeCollisionStiffness, "1f");
            globals.gpuMath.setUniformForProgram("collisionVelocityCalc", "u_nodeCollisionDMax", globals.nodeCollisionDMax, "1f");
            globals.gpuMath.setProgram("velocityCalc");
            globals.gpuMath.setUniformForProgram("velocityCalc", "u_axialStiffness", globals.axialStiffness, "1f");
            globals.gpuMath.setUniformForProgram("velocityCalc", "u_faceStiffness", globals.faceStiffness, "1f");
            globals.gpuMath.setProgram("positionCalcVerlet");
            globals.gpuMath.setUniformForProgram("positionCalcVerlet", "u_axialStiffness", globals.axialStiffness, "1f");
            globals.gpuMath.setUniformForProgram("positionCalcVerlet", "u_faceStiffness", globals.faceStiffness, "1f");
            setSolveParams();//recalc dt
        }
    }

    function updateExternalForces(){
        for (var i=0;i<nodes.length;i++){
            var externalForce = nodes[i].getExternalForce();
            externalForces[4*i] = externalForce.x;
            externalForces[4*i+1] = externalForce.y;
            externalForces[4*i+2] = externalForce.z;
        }
        globals.gpuMath.initTextureFromData("u_externalForces", textureDim, textureDim, "FLOAT", externalForces, true);
    }

    function updateFixed(){
        for (var i=0;i<nodes.length;i++){
            mass[4*i+1] = (nodes[i].isFixed() ? 1 : 0);
        }
        globals.gpuMath.initTextureFromData("u_mass", textureDim, textureDim, "FLOAT", mass, true);
    }

    function updateOriginalPosition(){
        for (var i=0;i<nodes.length;i++){
            var origPosition = nodes[i].getOriginalPosition();
            originalPosition[4*i] = origPosition.x;
            originalPosition[4*i+1] = origPosition.y;
            originalPosition[4*i+2] = origPosition.z;
        }
        globals.gpuMath.initTextureFromData("u_originalPosition", textureDim, textureDim, "FLOAT", originalPosition, true);
    }

    function updateCreaseVectors(){
        for (var i=0;i<creases.length;i++){
            var rgbaIndex = i*4;
            var nodes = creases[i].edge.nodes;
            // this.vertices[1].clone().sub(this.vertices[0]);
            creaseVectors[rgbaIndex] = nodes[0].getIndex();
            creaseVectors[rgbaIndex+1] = nodes[1].getIndex();
        }
        globals.gpuMath.initTextureFromData("u_creaseVectors", textureDimCreases, textureDimCreases, "FLOAT", creaseVectors, true);
    }

    function updateCreasesMeta(initing){
        for (var i=0;i<creases.length;i++){
            var crease = creases[i];
            creaseMeta[i*4] = crease.getK();
            // creaseMeta[i*4+1] = crease.getD();
            if (initing) creaseMeta[i*4+2] = crease.getTargetTheta();
        }
        globals.gpuMath.initTextureFromData("u_creaseMeta", textureDimCreases, textureDimCreases, "FLOAT", creaseMeta, true);
    }
    

    function updateLastPosition(){
        for (var i=0;i<nodes.length;i++){
            var _position = nodes[i].getRelativePosition();
            lastPosition[4*i] = _position.x;
            lastPosition[4*i+1] = _position.y;
            lastPosition[4*i+2] = _position.z;
        }
        globals.gpuMath.initTextureFromData("u_lastPosition", textureDim, textureDim, "FLOAT", lastPosition, true);
        globals.gpuMath.initFrameBufferForTexture("u_lastPosition", true);

    }

    function setCreasePercent(percent){
        if (!programsInited) return;
        globals.gpuMath.setProgram("velocityCalc");
        globals.gpuMath.setUniformForProgram("velocityCalc", "u_creasePercent", percent, "1f");
        globals.gpuMath.setProgram("positionCalcVerlet");
        globals.gpuMath.setUniformForProgram("positionCalcVerlet", "u_creasePercent", percent, "1f");
    }


    function updateWorldPosition(){ //DELETE written by codex
        if (!worldPosition || worldPosition.length !== nodes.length * 3){
            worldPosition = new Float32Array(nodes.length * 3);
        }
        for (var i=0;i<nodes.length;i++){
            var rgbaIndex = i*4;
            var xyzIndex = i*3;
            worldPosition[xyzIndex] = lastPosition[rgbaIndex] + originalPosition[rgbaIndex];
            worldPosition[xyzIndex+1] = lastPosition[rgbaIndex+1] + originalPosition[rgbaIndex+1];
            worldPosition[xyzIndex+2] = lastPosition[rgbaIndex+2] + originalPosition[rgbaIndex+2];
        }
    }

    function getNodeFaceCollisionMeta(currentPositions){ 
        // meta3 = [nodeCollisionFaceMetaIndex, numCollFaces, facesAreHitMetaIndex, numFacesHit]
        // nodeCollisionFaceMeta = [faceIndex, a, b, c, u, v, w, d] 
        // facesAreHitMeta = [faceIndex, -1, b, c, u, v, w, d] 
        
        meta3_ = new Float32Array(textureDim*textureDim*4);
        nodeCollisionFaceMeta_ = new Float32Array(textureDimNodeCollisions*textureDimNodeCollisions*4);        
        facesAreHitMeta_ = new Float32Array(textureDimNodeFaces2*textureDimNodeFaces2*4);

        var fillFacesAreHitMeta_ = [];
        var sort = []; // this will be used to sort facesareHitMeta later
        var index = 0; // index is faceGroupIndex
        var _index = 0;
        var WMinusP = [0, 0, 0];

        const sub = (u, v) => [u[0]-v[0], u[1]-v[1], u[2]-v[2]];
        const add = (u, v) => [u[0]+v[0], u[1]+v[1], u[2]+v[2]];
        const dot = (u, v) => u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
        const cross = (u, v) => [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
        const scale = (s, v) => [s*v[0], s*v[1], s*v[2]];


        for (var i=0;i<nodes.length;i++){ //node i
            meta3_[4*i+0] = index;
            var numFaceColl = 0;
             
            for (var j=0;j<faces.length;j++){ // face j
                if (i!=faces[j][0] && i!=faces[j][1] && i!=faces[j][2]){ // if node i is NOT connected to face j, move forward
                    // we are testing if node i (point W) is touching face j (triangle ABC)
                    // var W = [currentPositions[3*i], currentPositions[3*i+1], currentPositions[3*i+2]]; // [x,y,z]
                    // var A = [currentPositions[3*faces[j][0]], currentPositions[3*faces[j][0]+1], currentPositions[3*faces[j][0]+2]]; // [x,y,z]
                    // var B = [currentPositions[3*faces[j][1]], currentPositions[3*faces[j][1]+1], currentPositions[3*faces[j][1]+2]]; // [x,y,z]
                    // var C = [currentPositions[3*faces[j][2]], currentPositions[3*faces[j][2]+1], currentPositions[3*faces[j][2]+2]]; // [x,y,z]
   
                    // var AB = [B[0]-A[0], B[1]-A[1], B[2]-A[2]];
                    // var AC = [C[0]-A[0], C[1]-A[1], C[2]-A[2]];
                    
                    // var normal = cross(AB, AC); //DELETE
                    // var len = Math.sqrt(dot(normal, normal));
                    // normal = [normal[0] / len, normal[1] / len, normal[2] / len];

                    // var P = projectPointToPlane(A, B, C, W); //FIX: can skip is P in Triangle ABC if distWP is < thickness
                    // var baryInfo = isPInTriangleABC(A, B, C, P);
                    // var isInside = baryInfo.isInside;
                    // var u = baryInfo.alpha;
                    // var v = baryInfo.beta;
                    // var w = baryInfo.gamma;
                    
                    // var distWP = (W[0]-P[0])*(W[0]-P[0]) + (W[1]-P[1])*(W[1]-P[1]) + (W[2]-P[2])*(W[2]-P[2]); // FIX: make this signed distance - would help a lot distWP is currently always positive, so very close to zero
                    // distWP = Math.sqrt(distWP);
                    // var d = distWP*Math.sign(normalDotWMinusP); // d = d * sign(n dot (W-P))
                    // var dMax = globals.nodeCollisionDMax;

                    // var WMinusP = [W[0]-P[0], W[1]-P[1], W[2]-P[2]];
                    // var normalDotWMinusP = normal[0]*WMinusP[0] + normal[1]*WMinusP[1] + normal[2]*WMinusP[2];
                    

                    // See https://graphics.stanford.edu/papers/cloth-sig02/cloth.pdf
                    var x4 = [currentPositions[3*i], currentPositions[3*i+1], currentPositions[3*i+2]]; // [x,y,z]
                    var x1 = [currentPositions[3*faces[j][0]], currentPositions[3*faces[j][0]+1], currentPositions[3*faces[j][0]+2]]; // [x,y,z]
                    var x2 = [currentPositions[3*faces[j][1]], currentPositions[3*faces[j][1]+1], currentPositions[3*faces[j][1]+2]]; // [x,y,z]
                    var x3 = [currentPositions[3*faces[j][2]], currentPositions[3*faces[j][2]+1], currentPositions[3*faces[j][2]+2]]; // [x,y,z]
   
                    var x13 = sub(x1,x3);
                    var x23 = sub(x2,x3);
                    var x43 = sub(x4,x3);
                    var determinant = dot(x13,x13)*dot(x23,x23) - dot(x13,x23)*dot(x13,x23);

                    var u = 1/determinant * (dot(x23,x23)*dot(x13,x43) - dot(x13,x23)*dot(x23,x43));
                    var v = 1/determinant * (dot(x13,x13)*dot(x23,x43) - dot(x13,x23)*dot(x13,x43));
                    var w = 1.0-u-v;

                    var isInside =
                        0 <= u && u <= 1 &&
                        0 <= v && v  <= 1 &&
                        0 <= w && w <= 1 &&
                        Math.abs(1 - u - v - w) <= 0.0001;

                    var P = add(add(scale(u,x1),scale(v,x2)), scale(w,x3));
                    var distWP = Math.sqrt(dot(sub(x4,P),sub(x4,P)));
                    var dMax = globals.nodeCollisionDMax;

                    // trying to expand my options a bit
                    if (isInside == true && distWP < dMax*2){ // node i is officially colliding with face j
                        console.log("Node ", i, " is colliding with face ", j, "!!")
           
                        _index = (index + numFaceColl) * 2 * 4; // _index is the texel index,    _index + k is the element index

                        nodeCollisionFaceMeta_[_index] = j; // FaceIndex
                        nodeCollisionFaceMeta_[_index+1] = faces[j][0]; // a
                        nodeCollisionFaceMeta_[_index+2] = faces[j][1]; // b
                        nodeCollisionFaceMeta_[_index+3] = faces[j][2]; // c

                        nodeCollisionFaceMeta_[_index+4] = -1; // u
                        nodeCollisionFaceMeta_[_index+5] = -1; // v
                        nodeCollisionFaceMeta_[_index+6] = -1; // FIX AFTER TESTING
                        nodeCollisionFaceMeta_[_index+7] = -1; // d
                        
                        numFaceColl += 1;

                        for (var n=0; n<3; n++){ 
                            // we just hit a face, here is a texel entry for one of the nodes on the affected face
                            fillFacesAreHitMeta_.push(j); // faceIndex
                            fillFacesAreHitMeta_.push(faces[j][0]); // affected face node 0 - a
                            fillFacesAreHitMeta_.push(faces[j][1]); // affected face node 1 - b
                            fillFacesAreHitMeta_.push(faces[j][2]); // affected face node 2 - c
                            fillFacesAreHitMeta_.push(n);
                            fillFacesAreHitMeta_.push(i); //x4
                            fillFacesAreHitMeta_.push(-1); // FIX AFTER TESTING
                            fillFacesAreHitMeta_.push(-1); 
                            sort.push(faces[j][n]);
                        }
                    }
                }
            }
            index+=numFaceColl;
            meta3_[4*i+1] = numFaceColl;
        }

       

        // sort fillFacesAreHitMeta by nodes using the sort array map, lets hope this works!
        const BLOCK_SIZE = 8;
        let blocks = sort.map((val, i) => ({
            key: val,
            data: fillFacesAreHitMeta_.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE)
        }));
        blocks.sort((a, b) => a.key - b.key);
        sort = blocks.map(b => b.key);
        fillFacesAreHitMeta_ = blocks.flatMap(b => b.data);
        // YES!! it looks like it's working! but still make sure to look this over later


        
        // populate FacesAreHitMeta
        for (var i=0;i<fillFacesAreHitMeta_.length;i++){
            facesAreHitMeta_[i] = fillFacesAreHitMeta_[i];
        }


        // populate second half of meta3 using sort
        var index = 0;
        var sI = 0;
        var count = 0
        for (var i=0; i<nodes.length; i++){
            meta3_[4*i+2] = index;
            if (i==sort[sI]){
                count = sort.filter(n => n === i).length; // count how many times i appears in sort
                sI += count;
                meta3_[4*i+3] = count;
            }
            index += count;
            count = 0;
        }
        
        return [meta3_, nodeCollisionFaceMeta_, facesAreHitMeta_]
    }

    function projectPointToPlane(A, B, C, W){ // project point W to the plane defined by triangle ABC
        //DELETE
        // see https://stackoverflow.com/questions/9605556/how-to-project-a-point-onto-a-plane-in-3d/17661431#17661431

        const sub = (u, v) => [u[0]-v[0], u[1]-v[1], u[2]-v[2]];
        const dot = (u, v) => u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
        const cross = (u, v) => [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
        const scale = (s, v) => [s*v[0], s*v[1], s*v[2]];

        const AB = sub(A,B);
        const AC = sub(A,C);
        const N = cross(AB,AC);

        const WA = sub(W, A);               // step 1: v = point of interest - origin
        const dist = dot(WA, N)/dot(N, N);  // step 2: dist = v dotted with N (added normalization for N)
        const P = sub(W, scale(dist,N));    // step 3: P = W - dist*N

        return P;
    }


    function isPInTriangleABC(A, B, C, P){
        //DELETE
        // see: https://math.stackexchange.com/questions/4322/check-whether-a-point-is-within-a-3d-triangle

        const sub = (u, v) => [u[0]-v[0], u[1]-v[1], u[2]-v[2]];
        const dot = (u, v) => u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
        const cross = (u, v) => [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
        const scale = (s, v) => [s*v[0], s*v[1], s*v[2]];
        const norm = (u) => Math.sqrt(dot(u, u)); // firgure out how to get rid of square root -- my mini-mental check said yes theres a way to do it - kinda just square everything

        const AB = sub(A,B);
        const AC = sub(A,C);
        const PB = sub(P,B);
        const PC = sub(P,C);
        const PA = sub(P,A);

        var n = cross(AB, AC);
        n = scale(1/norm(n), n);

        const AreaABC = dot(cross(AB,AC), n)/2; // figure out how to do signed area
        // wikipedia barycentric coordinates: "The sign is plus if the path from A to B to C then back to A goes around the triangle in a counterclockwise direction. The sign is minus if the path goes around in a clockwise direction."
        // use normal dot itself for the signed area 
        const alpha = dot(cross(PB,PC),n)/(2*AreaABC);
        const beta = dot(cross(PC,PA),n)/(2*AreaABC);
        const gamma = 1-alpha-beta;
        

        const isInside =
        0 <= alpha && alpha <= 1 &&
        0 <= beta  && beta  <= 1 &&
        0 <= gamma && gamma <= 1 &&
        Math.abs(1 - alpha - beta - gamma) <= 0.0001;

    return {isInside, alpha, beta, gamma };
    }


    function getEdgeEdgeCollisionMeta(currentPositions){  // add in beamCollisionMeta_ as an arg when ready
        // beamCollisionMeta_ will need to be augmented and returned
        var fillBeam = []; // fillbeam will be filled with beamCollisionMeta info then cleaned and sorted to fill in beamCollisionMeta_
        //var beamCollisionMeta; // [u, v, w, otherNodeIndex]

        for (var i=0;i<edges.length;i++){ // edge i
            var Pi = edges[i].nodes[0].index; // P node index
            var Qi = edges[i].nodes[1].index; // Q node index
            var P = [currentPositions[3*Pi], currentPositions[3*Pi+2], currentPositions[3*Pi+1]] // [x,y,z]
            var Q = [currentPositions[3*Qi], currentPositions[3*Qi+2], currentPositions[3*Qi+1]] // [x,y,z]

            for (var j=0;j<faces.length;j++){ // face j
                var A = [currentPositions[3*faces[j][0]], currentPositions[3*faces[j][0]+2], currentPositions[3*faces[j][0]+1]]; // [x,y,z]
                var B = [currentPositions[3*faces[j][1]], currentPositions[3*faces[j][1]+2], currentPositions[3*faces[j][1]+1]]; // [x,y,z]
                var C = [currentPositions[3*faces[j][2]], currentPositions[3*faces[j][2]+2], currentPositions[3*faces[j][2]+1]]; // [x,y,z]
                var test = false;

                var Ai = faces[j][0]; // A node index
                var Bi = faces[j][1]; // B node index
                var Ci = faces[j][2]; // C node index

                
                // don't test edges against the face it's a part of  -> if (Pi === Ai || Pi === Bi || Pi === Ci) && (Qi === Ai || Qi === Bi || Qi === Ci) continue
                // Also dont test edges against races that it's touching
                if (Pi === Ai || Pi === Bi || Pi === Ci || Qi === Ai || Qi === Bi || Qi === Ci){
                    continue;
                }

                var u = 0;
                var v = 0;
                var w = 0;
                var t = 0;
                [u, v, w, t, test] = isLineSegmentPQinTriangleABC(P,Q,A,B,C); 
                if (test==true){
                    //edge i is officially colliding with face j
                    console.log("Edge ", i, "is collidding with face ", j);
                    fillBeam.push(u); // add one row per node on beam
                    fillBeam.push(v);
                    fillBeam.push(w);
                    fillBeam.push(Pi);

                    fillBeam.push(u);
                    fillBeam.push(v);
                    fillBeam.push(w);
                    fillBeam.push(Qi);
                    //var beamCollisionMeta; // [u, v, w, otherNodeIndex]
                    //console.log("u, w, w, t are: ", u, v, w, t);
                    // NEXT STEP: figure out how to log info correctly like in nodefacemeta
                    // probably will take a similar form to nodefacemeta, but beam meta with -1 
                    // need to store the info accordingly, how is beam meta stored?
                }
            }
        } 
    }


    function isLineSegmentPQinTriangleABC(P,Q,A,B,C){
        // See Real Time Collision Detection by Christer Ericson seciton 5.3.6 Intersecting Ray or segment against triangle
        const sub = (u, v) => [u[0]-v[0], u[1]-v[1], u[2]-v[2]];
        const dot = (u, v) => u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
        const cross = (u, v) => [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];

        var n = cross(sub(B,A), sub(C,A));
        var d = dot(sub(P,Q), n);
        var e = cross(sub(P,Q), sub(P,A));


        const EPS = 1e-8;
        if (Math.abs(d) < EPS) {
            // if d = 0, the ray is parrallel to the triangle, but what about a ray that interects the triangle at a smaller line segment instead of a point?
            return [0,0,0,0,false]; // treat coplanar separately later if needed
        }

        var t = dot(sub(P,A), n) / d;
        var v = dot(sub(C,A), e) / d;
        var w = -dot(sub(B,A), e) / d;
        var u = 1.0-v-w;

        if (u>=0 && v>=0 && w>=0 && t>=0 && u<=1 && v<=1 && w<=1 && t<=1){
            return [u, v, w, t, true];
        }else{
            return [u, v, w, t, false];
        }
    }










    function initTypedArrays(){
        if (collisionsEnabled) {
            console.log("Collisions are enabled!!")
        }else{
            console.log("Collisions are off")
        }

        textureDim = calcTextureSize(nodes.length);

        var numNodeFaces = 0;
        var nodeFaces = [];
        for (var i=0;i<nodes.length;i++){
            nodeFaces.push([]);
            for (var j=0;j<faces.length;j++){
                if (faces[j].indexOf(i)>=0) {
                    nodeFaces[i].push(j);
                    numNodeFaces++;
                }
            }
        }
        textureDimNodeFaces = calcTextureSize(numNodeFaces);
        textureDimNodeFaces2 = calcTextureSize(numNodeFaces*2*2); // for facesAreHitMeta
        textureDimNodeCollisions = calcTextureSize(faces.length*nodes.length*2); // for nodeCollisionFaceMeta


        var numEdges = 0;
        for (var i=0;i<nodes.length;i++){
            numEdges += nodes[i].numBeams();
        }
        textureDimEdges = calcTextureSize(numEdges);

        var numCreases = creases.length;
        textureDimCreases = calcTextureSize(numCreases);

        var numNodeCreases = 0;
        for (var i=0;i<nodes.length;i++){
            numNodeCreases += nodes[i].numCreases();
        }
        numNodeCreases += numCreases*2;//reactions
        textureDimNodeCreases = calcTextureSize(numNodeCreases);

        var numFaces = faces.length;
        textureDimFaces = calcTextureSize(numFaces);

        originalPosition = new Float32Array(textureDim*textureDim*4);
        position = new Float32Array(textureDim*textureDim*4);
        lastPosition = new Float32Array(textureDim*textureDim*4);
        lastLastPosition = new Float32Array(textureDim*textureDim*4);
        velocity = new Float32Array(textureDim*textureDim*4);
        lastVelocity = new Float32Array(textureDim*textureDim*4);
        externalForces = new Float32Array(textureDim*textureDim*4);
        mass = new Float32Array(textureDim*textureDim*4);
        meta = new Float32Array(textureDim*textureDim*4);
        meta2 = new Float32Array(textureDim*textureDim*4);
        meta3 = new Float32Array(textureDim*textureDim*4);
        beamMeta = new Float32Array(textureDimEdges*textureDimEdges*4);
        //beamCollisionMeta = new Float32Array(textureDimEdges*textureDimEdges*4); // FIX: I don't think this is the correct amount
        // ^ uncomment when ready
        normals = new Float32Array(textureDimFaces*textureDimFaces*4);
        faceVertexIndices = new Float32Array(textureDimFaces*textureDimFaces*4);
        creaseMeta = new Float32Array(textureDimCreases*textureDimCreases*4);
        nodeFaceMeta = new Float32Array(textureDimNodeFaces*textureDimNodeFaces*4);
        nodeCollisionFaceMeta = new Float32Array(textureDimNodeCollisions*textureDimNodeCollisions*4);        
        facesAreHitMeta = new Float32Array(textureDimNodeFaces2*textureDimNodeFaces2*4);// facesAreHitMeta = [faceIndex, -1, b, c, u, v, w, d]  where abc are the triangle you are on, uvw barycentric coords, d penetration depth
        // CHECK: what should the square size of facesAreHitMeta be?
        nominalTriangles = new Float32Array(textureDimFaces*textureDimFaces*4);
        nodeCreaseMeta = new Float32Array(textureDimNodeCreases*textureDimNodeCreases*4);
        creaseMeta2 = new Float32Array(textureDimCreases*textureDimCreases*4);
        creaseGeo = new Float32Array(textureDimCreases*textureDimCreases*4);
        creaseVectors = new Float32Array(textureDimCreases*textureDimCreases*4);
        theta = new Float32Array(textureDimCreases*textureDimCreases*4);
        lastTheta = new Float32Array(textureDimCreases*textureDimCreases*4);
        gpuCollisionPositions = new Float32Array(nodes.length*3); //TESTING GPU POSITIONS

        for (var i=0;i<faces.length;i++){
            var face = faces[i];
            faceVertexIndices[4*i] = face[0];
            faceVertexIndices[4*i+1] = face[1];
            faceVertexIndices[4*i+2] = face[2];

            var a = nodes[face[0]].getOriginalPosition();
            var b = nodes[face[1]].getOriginalPosition();
            var c = nodes[face[2]].getOriginalPosition();
            var ab = (b.clone().sub(a)).normalize();
            var ac = (c.clone().sub(a)).normalize();
            var bc = (c.clone().sub(b)).normalize();
            nominalTriangles[4*i] = Math.acos(ab.dot(ac));
            nominalTriangles[4*i+1] = Math.acos(-1*ab.dot(bc));
            nominalTriangles[4*i+2] = Math.acos(ac.dot(bc));

            if (Math.abs(nominalTriangles[4*i]+nominalTriangles[4*i+1]+nominalTriangles[4*i+2]-Math.PI)>0.1){
                console.warn("bad angles");
            }
        }


        for (var i=0;i<textureDim*textureDim;i++){
            mass[4*i+1] = 1;//set all fixed by default
        }

        for (var i=0;i<textureDimCreases*textureDimCreases;i++){
            if (i >= numCreases){
                lastTheta[i*4+2] = -1;
                lastTheta[i*4+3] = -1;
                continue;
            }
            lastTheta[i*4+2] = creases[i].getNormal1Index();
            lastTheta[i*4+3] = creases[i].getNormal2Index();
        }

        var index = 0;
        for (var i=0;i<nodes.length;i++){
            meta2[4*i] = index;
            var num = nodeFaces[i].length;
            meta2[4*i+1] = num;
            for (var j=0;j<num;j++){
                var _index = (index+j)*4;
                var face = faces[nodeFaces[i][j]];
                nodeFaceMeta[_index] = nodeFaces[i][j];
                nodeFaceMeta[_index+1] = face[0] == i ? -1 : face[0];
                nodeFaceMeta[_index+2] = face[1] == i ? -1 : face[1];
                nodeFaceMeta[_index+3] = face[2] == i ? -1 : face[2];
            }
            index+=num;
        }


        [meta3, nodeCollisionFaceMeta, facesAreHitMeta] = getNodeFaceCollisionMeta(positions, 3);         
        getEdgeEdgeCollisionMeta(positions);

        




        var index = 0;
        for (var i=0;i<nodes.length;i++){
            mass[4*i] = nodes[i].getSimMass();
            meta[i*4+2] = index;
            var nodeCreases = nodes[i].creases;
            var nodeInvCreases = nodes[i].invCreases;//nodes attached to crease move in opposite direction
            // console.log(nodeInvCreases);
            meta[i*4+3] = nodeCreases.length + nodeInvCreases.length;
            for (var j=0;j<nodeCreases.length;j++){
                nodeCreaseMeta[index*4] = nodeCreases[j].getIndex();
                nodeCreaseMeta[index*4+1] = nodeCreases[j].getNodeIndex(nodes[i]);//type 1, 2, 3, 4
                index++;
            }
            for (var j=0;j<nodeInvCreases.length;j++){
                nodeCreaseMeta[index*4] = nodeInvCreases[j].getIndex();
                nodeCreaseMeta[index*4+1] = nodeInvCreases[j].getNodeIndex(nodes[i]);//type 1, 2, 3, 4
                index++;
            }
        }
        for (var i=0;i<creases.length;i++){
            var crease = creases[i];
            creaseMeta2[i*4] = crease.node1.getIndex();
            creaseMeta2[i*4+1] = crease.node2.getIndex();
            creaseMeta2[i*4+2] = crease.edge.nodes[0].getIndex();
            creaseMeta2[i*4+3] = crease.edge.nodes[1].getIndex();
            index++;
        }

        updateOriginalPosition();
        updateMaterials(true);
        updateFixed();
        updateExternalForces();
        updateCreasesMeta(true);
        updateCreaseVectors();
        setCreasePercent(globals.creasePercent);
    }

    return {
        syncNodesAndEdges: syncNodesAndEdges,
        updateFixed: updateFixed,
        solve: solve,
        render: render,
        reset: reset, 
        calculateFaceBarycentersFromPositions: calculateFaceBarycentersFromPositions, // DELETE: for barcenter viualization
        setFaceBarycentersVisibility: setFaceBarycentersVisibility // DELETE: for barcenter viualization
    }
}