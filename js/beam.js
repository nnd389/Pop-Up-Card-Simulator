/**
 * Created by ghassaei on 9/16/16.
 */

// var beamMaterialHighlight = new THREE.LineBasicMaterial({color: 0xff0000, linewidth: 1});
// var beamMaterial = new THREE.LineBasicMaterial({color: 0x000000, linewidth: 1});

function Beam(nodes, edge_assignment){

    if (edge_assignment == "G"){
        this.type = "glue tab beam";
    } else if (edge_assignment == "GS"){
        this.type = "glue spring beam"
    } else if (edge_assignment == "B"){
        this.type = "boundary beam"
    } else if (edge_assignment == "M"){
        this.type = "mountain beam"
    } else if (edge_assignment == "V"){
        this.type = "valley beam"
    } else if (edge_assignment == "F"){
        this.type = "facet beam"
    } else if (edge_assignment == "C"){
        this.type = "cut beam"
    } else if (edge_assignment == "U"){
        this.type = "hinge beam"
    }
    else{
        this.type = "regular beam";
    }
    

    nodes[0].addBeam(this);
    nodes[1].addBeam(this);
    this.vertices = [nodes[0]._originalPosition, nodes[1]._originalPosition];
    this.nodes = nodes;

    // var lineGeometry = new THREE.Geometry();
    // lineGeometry.dynamic = true;
    // lineGeometry.vertices = this.vertices;

    // this.object3D = new THREE.Line(lineGeometry, beamMaterial);
    this.originalLength = this.getLength(edge_assignment);
    
}

// Beam.prototype.highlight = function(){
//     this.object3D.material = beamMaterialHighlight;
// };
//
// Beam.prototype.unhighlight = function(){
//     this.object3D.material = beamMaterial;
// };

Beam.prototype.getLength = function(assignment){
    if (assignment == "glue spring beam"){
        return 0.01;
    } else{
        return this.getVector().length();
    }
    return this.getVector().length();
};
Beam.prototype.getOriginalLength = function(){
    return this.originalLength;
};
Beam.prototype.recalcOriginalLength = function(edge_assignment){
    // if (edge_assignment == "G"){
    //     this.originalLength = 0.01;
    // } else{
    //     this.originalLength = this.getVector().length();
    // }
    this.originalLength = this.getVector().length();
};

Beam.prototype.isFixed = function(){
    return this.nodes[0].fixed && this.nodes[1].fixed;
};

Beam.prototype.getVector = function(fromNode){
    if (fromNode == this.nodes[1]) return this.vertices[0].clone().sub(this.vertices[1]);
    return this.vertices[1].clone().sub(this.vertices[0]);
};

// Beam.prototype.setVisibility = function(state){
//     this.object3D.visible = state;
// };



//dynamic solve

Beam.prototype.getK = function(){
    return globals.axialStiffness/this.getLength();
};

Beam.prototype.getD = function(){
    return globals.percentDamping*2*Math.sqrt(this.getK()*this.getMinMass());
};

Beam.prototype.getNaturalFrequency = function(){
    return Math.sqrt(this.getK()/this.getMinMass());
};

Beam.prototype.getMinMass = function(){
    var minMass = this.nodes[0].getSimMass();
    if (this.nodes[1].getSimMass()<minMass) minMass = this.nodes[1].getSimMass();
    return minMass;
};

Beam.prototype.getOtherNode = function(node){
    if (this.nodes[0] == node) return this.nodes[1];
    return this.nodes[0];
};

// var valleyColor = new THREE.LineBasicMaterial({color:0x0000ff});
// var mtnColor = new THREE.LineBasicMaterial({color:0xff0000});

// Beam.prototype.setMountain = function(){
//     this.object3D.material = mtnColor;
// };
//
// Beam.prototype.setValley = function(){
//     this.object3D.material = valleyColor;
// };


//render

// Beam.prototype.getObject3D = function(){
//     return this.object3D;
// };

// Beam.prototype.render = function(shouldComputeLineDistance){
//     this.object3D.geometry.verticesNeedUpdate = true;
//     this.object3D.geometry.computeBoundingSphere();
//     if (shouldComputeLineDistance) this.object3D.geometry.computeLineDistances();//for dashed lines
// };




//deallocate

Beam.prototype.destroy = function(){
    var self = this;
    _.each(this.nodes, function(node){
        node.removeBeam(self);
    });
    this.vertices = null;
    // this.object3D = null;
    this.nodes = null;
};