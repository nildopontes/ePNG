class ePNG {
   constructor(data, w, h, filter){
      this.h = h;
      this.w = w;
      if(data.length != (w * h * 4)) return console.error(`Incomplete samples.`);
      this.data = data;
      this.makeCRCTable();
      this.colorStatistics();
      this.pixelSize = [1,,3,1,2,,4][this.colorType];
      this.widthScanline =  (w * this.pixelSize) + 1;
      this.signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      this.ihdr = new Uint8Array([0, 0, 0, 13, 73, 72, 68, 82, ...this.set32bit(w), ...this.set32bit(h), 8, this.colorType, 0, 0, 0, 0, 0, 0, 0]);
      this.ihdr.set(this.set32bit(this.getCRC32(this.ihdr.slice(4, 21))), 21);
      this.iend = new Uint8Array([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
      this.filter = this.colorType == 3 ? 0 : ([0, 1, 2, 3, 4].includes(filter) ? filter : 5);
      this.buffer = new Uint8Array((w * h * this.pixelSize) + h);
   }
   indexOf(colors, int32){
      let iterator = colors.keys();
      for(let i = 0; i < colors.size; i++){
         if(iterator.next().value == int32) return i;
      }
      return null;
   }
   colorStatistics(){
      let qtdAlpha = 0, i, colors = new Set(), transparentColors = new Set(), qtdGrayscale = 0, qtdTransparent = 0;
      for(i = 0; i < this.data.length; i += 4){
         let int32 = this.dump32bit(this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]);
         colors.add(int32);
         if(this.data[i + 3] != 255) qtdAlpha++;
         if(this.data[i + 3] == 0){
            transparentColors.add(int32);
            qtdTransparent++;
         }
         if(this.data[i] == this.data[i + 1] && this.data[i + 1] == this.data[i + 2]) qtdGrayscale++;
      }
      if(qtdGrayscale == this.w * this.h){
         this.colorType = qtdAlpha == qtdTransparent && transparentColors.size < 2 ? 0 : 4;
      }else{
         this.colorType = colors.size < 257 ? 3 : ((qtdAlpha == qtdTransparent && transparentColors.size < 2) ? 2 : 6);
      }
      if(transparentColors.size == 1 && this.colorType < 3 && this.indexOf(colors, transparentColors.keys().next().value + 255) != -1) this.colorType += 4;
      switch(this.colorType){
         case 0:{
            for(i = 1; i < this.data.length; i += 4){
               this.data[i] = undefined;
               this.data[i + 1] = undefined;
               this.data[i + 2] = undefined;
            }
            break;
         }
         case 2:{
            for(i = 3; i < this.data.length; i += 4){
               this.data[i] = undefined;
            }
            break;
         }
         case 3:{
            for(i = 0; i < this.data.length; i += 4){
               let int32 = this.dump32bit(this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]);
               this.data[i] = this.indexOf(colors, int32);
               this.data[i + 1] = undefined;
               this.data[i + 2] = undefined;
               this.data[i + 3] = undefined;
            }
            this.addPLTE(colors);
            if(qtdAlpha > 0) this.addtRNS(colors);
            break;
         }
         case 4:{
            for(i = 1; i < this.data.length; i += 4){
               this.data[i] = undefined;
               this.data[i + 1] = undefined;
            }
         }
      }
      if(transparentColors.size == 1 && this.colorType < 3) this.addtRNS(transparentColors.keys().next().value);
      this.data = this.data.filter(sample => sample !== undefined);
   }
   addtRNS(trns){
      switch(this.colorType){
         case 0:{
            this.trns = new Uint8Array(14);
            this.trns.set([2, 116, 82, 78, 83, 0, this.set32bit(trns).slice(0, 1)], 3);
            this.trns.set(this.set32bit(this.getCRC32(this.trns.slice(4, 10))), 10);
            break;
         }
         case 2:{
            this.trns = new Uint8Array(18);
            let rgb = this.set32bit(trns);
            this.trns.set([6, 116, 82, 78, 83, 0, rgb[0], 0, rgb[1], 0, rgb[2]], 3);
            this.trns.set(this.set32bit(this.getCRC32(this.trns.slice(4, 14))), 14);
            break;
         }
         case 3:{
            let iterator = trns.keys();
            this.trns = new Uint8Array(trns.size + 12);
            this.trns.set(this.set32bit(trns.size));
            this.trns.set([116, 82, 78, 83], 4);
            for(let i = 0; i < trns.size; i++){
               this.trns[8 + i] = this.set32bit(iterator.next().value).slice(3);
            }
            this.trns.set(this.set32bit(this.getCRC32(this.trns.slice(4, 8 + trns.size))), 8 + trns.size);
            break;
         }
      }
   }
   addPLTE(colors){
      this.palette = new Uint8Array(colors.size * 3 + 12);
      this.palette.set(this.set32bit(colors.size * 3));
      this.palette.set([80, 76, 84, 69], 4);
      let iterator = colors.keys();
      for(let i = 0; i < colors.size; i++){
         this.palette.set(this.set32bit(iterator.next().value).slice(0, 3), 8 + i * 3);
      }
      this.palette.set(this.set32bit(this.getCRC32(this.palette.slice(4, 8 + colors.size * 3))), 8 + colors.size * 3);
   }
   dump32bit(a, b, c, d){
      return (a << 24) + (b << 16) + (c << 8) + d;
   }
   set32bit(v){
     return new Uint8Array([v >> 24 & 255, v >> 16 & 255, v >> 8 & 255, v & 255]);
   }
   makeCRCTable(){
      let c, a = [];
      for(let n = 0; n < 256; n++){
         c = n;
         for(let k = 0; k < 8; k++){
            c = c & 1 ? 0xEDB88320 ^ c >>> 1 : c >>> 1;
         }
         a.push(c);
      }
      this.crcTable = a;
   }
   filter0(){
      this.scanlines = [];
      for(let i = 0; i < this.h; i++){
         this.scanlines.push(new Uint8Array([0, ...this.data.slice(i * this.w * this.pixelSize, (i + 1) * this.w * this.pixelSize)]));
      }
      for(let i = this.h - 1; i >= 0; i--){
         if(this.filter == 5){
            let minSum = Number.MAX_VALUE, realFilter, aux = [];
            for(let ft = 0; ft < 5; ft++){
               aux.push(this.filterScanline(ft, i, true));
               if(aux[aux.length - 1][1] < minSum){
                  minSum = aux[aux.length - 1][1];
                  realFilter = ft;
               }
            }
            this.scanlines[i] = aux[realFilter][0];
         }else{
            this.scanlines[i] = this.filterScanline(this.filter, i);
         }
      }      
      this.scanlines.map((v, i) => {
         this.buffer.set(v, this.widthScanline * i);
      });
      return this.buffer;
   }
   paeth(a, b, c){
      let pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - c - c);
      if(pb < pa){
         a = b;
         pa = pb;
      }
      return pc < pa ? c : a;
   }
   filterScanline(type, i, returnSum){
      if(this.scanlines[i] === undefined) return console.error(`Scanline ${i} non-existent.`);
      let filtered = new Uint8Array(this.widthScanline), j, rawA, rawB, rawC;
      filtered[0] = type;
      switch(type){
         case 0:{
            filtered = this.scanlines[i];
            break;
         }
         case 1:{
            for(j = 1; j < this.widthScanline; j++){
               j < this.pixelSize + 1 ? filtered[j] = this.scanlines[i][j] : filtered[j] = this.scanlines[i][j] - this.scanlines[i][j - this.pixelSize];
            }
            break;
         }
         case 2:{
            if(i == 0){
               filtered = this.scanlines[i];
            }else{
               for(j = 1; j < this.widthScanline; j++) filtered[j] = this.scanlines[i][j] - this.scanlines[i - 1][j];
            }
            break;
         }
         case 3:{
            for(j = 1; j < this.widthScanline; j++){
               rawA = j > this.pixelSize ? this.scanlines[i][j - this.pixelSize] : 0;
               rawB = i > 0 ? this.scanlines[i - 1][j] : 0;
               filtered[j] = this.scanlines[i][j] - Math.floor((rawA + rawB) / 2);
            }
            break;
         }
         case 4:{
            for(j = 1; j < this.widthScanline; j++){
               rawA = j > this.pixelSize ? this.scanlines[i][j - this.pixelSize] : 0;
               rawB = i > 0 ? this.scanlines[i - 1][j] : 0;
               rawC = j > this.pixelSize && i > 0 ? this.scanlines[i - 1][j - this.pixelSize] : 0;
               filtered[j] = this.scanlines[i][j] - this.paeth(rawA, rawB, rawC);
            }
         }
      }
      if(returnSum){
         let sum = filtered.reduce((accumulator, value) => accumulator + value) - type;
         return [filtered, sum];
      }else{
         return filtered;
      }
   }
   getCRC32(data){
      let crc = -1;
      data.map(v => crc = crc >>> 8 ^ this.crcTable[(crc ^ v) & 255]);
      return crc ^ -1 >>> 0;
   }
   compress(input){
     const cs = new CompressionStream('deflate');
     const writer = cs.writable.getWriter();
     writer.write(input);
     writer.close();
     return new Response(cs.readable).arrayBuffer();
   }
   encode(){
      return new Promise((resolve, reject) => {
         this.compress(this.filter0()).then(c => {
            let cp = new Uint8Array(c);
            this.idat = new Uint8Array(cp.length + 12);
            this.idat.set(this.set32bit(cp.length));
            this.idat.set([73, 68, 65, 84], 4);
            this.idat.set(cp, 8);
            this.idat.set(this.set32bit(this.getCRC32(this.idat.slice(4, 8 + cp.length))), cp.length + 8);
            this.blob = new Blob([this.signature, this.ihdr, this.palette || [], this.trns || [], this.idat, this.iend], {type: "image/png"});
            resolve(this.blob);
         });
      });
   }
}
