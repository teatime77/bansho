const PseudoColor = `
vec3 PseudoColor(float min_val, float max_val, float val){
    float f = (max(min_val, min(max_val, val)) - min_val) / (max_val - min_val);

    vec3 col;
    if(f < 0.25){
        col.r = 0.0;
        col.g = f / 0.25;
        col.b = 1.0;
    }
    else if(f < 0.5){
        col.r = 0.0;
        col.g = 1.0;
        col.b = (0.5 - f) / 0.25;
    }
    else if(f < 0.75){
        col.r = (f - 0.5) / 0.25;
        col.g = 1.0;
        col.b = 0.0;
    }
    else {
        col.r = 1.0;
        col.g = (1.0 - f) / 0.25;
        col.b = 0.0;
    }

    return col;
}
`;

const K = 1.0 / 16.0;

function volumeWave(sx, sy, sz){ 
    return `

precision highp sampler3D;

uniform int   tick;
    
uniform sampler3D inE;
uniform sampler3D inH;
out vec3 outE;
out vec3 outH;

#define PI 3.14159265359

#define mu0      1.25663706212e-06
#define epsilon0 8.854187812799999e-12
#define c0       299792458

${PseudoColor}

vec3 calcRot(int flag, vec3 E, vec3 H, int i, int j, int k){

    if(flag == 1){
        vec4 Ei = texelFetch(inE, ivec3(i + 1, j    , k    ), 0);
        vec4 Ej = texelFetch(inE, ivec3(i    , j + 1, k    ), 0);
        vec4 Ek = texelFetch(inE, ivec3(i    , j    , k + 1), 0);

        float rx = (Ej.z - E.z) - (Ek.y - E.y);
        float ry = (Ek.x - E.x) - (Ei.z - E.z);
        float rz = (Ei.y - E.y) - (Ej.x - E.x);

        // float rx = (Ej.z - E.z);
        // float ry =  - (Ei.z - E.z);
        // float rz = 0.0;

        return vec3(rx, ry, rz);
    }
    else{

        vec4 Hi = texelFetch(inH, ivec3(i - 1, j    , k    ), 0);
        vec4 Hj = texelFetch(inH, ivec3(i    , j - 1, k    ), 0);
        vec4 Hk = texelFetch(inH, ivec3(i    , j    , k - 1), 0);

        float rx = (H.z - Hj.z) - (H.y - Hk.y);
        float ry = (H.x - Hk.x) - (H.z - Hi.z);
        float rz = (H.y - Hi.y) - (H.x - Hj.x);

        // float rx =   (H.z - Hj.z);
        // float ry = - (H.z - Hi.z);
        // float rz = 0.0;

        return vec3(rx, ry, rz);
    }
}

void main(void) {
    float L = 3.2 / float(${Math.max(sx, sy, sz)});
    float K = float(${K});

    int idx = int(gl_VertexID);

    int col  = idx % ${sx};
    idx     /= ${sx};

    int row  = idx % ${sy};
    int dep  = idx / ${sy};

    float x = -1.6 + float(col) * L;
    float y = -1.6 + float(row) * L;
    float z = -1.6 + float(dep) * L;

    vec4 E0 = texelFetch(inE, ivec3(col, row, dep), 0);
    vec4 H0 = texelFetch(inH, ivec3(col, row, dep), 0);

    vec3 E = vec3(E0.x, E0.y, E0.z);
    vec3 H = vec3(H0.x, H0.y, H0.z);

    if(${Math.max(sx, sy, sz)} <= tick){
        outE          = E;
        outH          = H;
        return;
    }

    if(col == ${sx} / 2 && row == ${sy} / 2 && dep == ${sz} / 2){

        // E.x = 0.1 * cos(float(tick) / 10000.0);
        if(tick == 0){

            E.x = 1.0;
        }
        else{

            E.x += 0.0;
        }

        // float t = float(tick) / 10.0 - 0.5;
        // E.z += exp(- t * t);

    }
    else if(col == 0 || row == 0 || dep == 0 || col == ${sx} - 1 || row == ${sy} - 1 || dep == ${sz} - 1){
        E = vec3(0.0, 0.0, 0.0);
        H = vec3(0.0, 0.0, 0.0);
    }
    else{
        if(tick == 0){
        }
        else{

            if(tick % 2 == 0){

                vec3 rotH = calcRot(0, E, H, col, row, dep);
                E = E + K * rotH;
            }
            else{
                vec3 rotE = calcRot(1, E, H, col, row, dep);
                H = H - rotE;
            }
        }
    }

    outE = E;
    outH = H;
}`;
}

function ArrowWave(sx, sy, sz){ 
    return `

precision highp sampler3D;

uniform mat4 uPMVMatrix;
uniform mat3 uNMatrix;
uniform int   tick;

uniform sampler3D inE;
uniform sampler3D inH;

out vec4 fragmentColor;

#define PI 3.14159265359

void main(void) {
    float L = 3.2 / float(${Math.max(sx, sy, sz)});

    int idx = int(gl_VertexID);

    int ip   = idx % 4;
    idx     /= 4;

    int col  = idx % ${sx};
    idx     /= ${sx};

    int row  = idx % ${sy};
    int dep  = idx / ${sy};

    float x = -1.6 + float(col) * L;
    float y = -1.6 + float(row) * L;
    float z = -1.6 + float(dep) * L;

    if(ip == 1 || ip == 3){

        vec4 v;
        if(ip == 1){
            v = texelFetch(inE, ivec3(col, row, dep), 0);            
        }
        else{
            v = texelFetch(inH, ivec3(col, row, dep), 0);            
        }

        x += v.x;
        y += v.y;
        z += v.z;
    }

    if(ip == 0 || ip == 1){

        fragmentColor = vec4(0.0, 0.0, 1.0, 1.0);
    }
    else{

        fragmentColor = vec4(1.0, 0.0, 0.0, 1.0);
    }

    gl_Position = uPMVMatrix * vec4(x, y, z, 1.0);
}`;
}
