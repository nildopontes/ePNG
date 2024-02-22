class ePNG {
   constructor(data, w, h, filter){
      this.h = h;
      this.w = w;
      if(data.length != (w * h * 4)) return console.error(`Incomplete samples.`);
      this.data = data;
      this.crcTable = new Array();
      let qtdAlpha = 0, i;
      for(i = 3; i < this.data.length; i += 4){
         if(this.data[i] != 255) qtdAlpha++;
      }
      this.colorType = (qtdAlpha == 0) ? 2 : 6;
      if(this.colorType == 2){
         for(i = 3; i < this.data.length; i += 4){
            this.data[i] = undefined;
         }
         this.data = this.data.filter(sample => sample !== undefined);
      }
      this.pixelSize = [,,3,,,,4][this.colorType];
      this.widthScanline =  (w * this.pixelSize) + 1;
      this.signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      this.ihdr = new Uint8Array(25);
      this.ihdr.set([0, 0, 0, 13, 73, 72, 68, 82]);
      this.ihdr.set(this.set32bit(w), 8);
      this.ihdr.set(this.set32bit(h), 12);
      this.ihdr.set([8, this.colorType, 0, 0, 0], 16);
      this.ihdr.set(this.set32bit(this.getCRC32(this.ihdr.slice(4, 21))), 21);
      this.idat = null;
      this.iend = new Uint8Array([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
      this.filter = ([0, 1, 2, 3, 4, 5].includes(filter)) ? filter : 5;
      this.scanlines = new Array(h);
      this.buffer = new Uint8Array((w * h * this.pixelSize) + h);
      this.blob = null;
   }
   set32bit(value){
     let buffer = new Uint8Array(4);
     buffer[0] = (value >> 24) & 255;
     buffer[1] = (value >> 16) & 255;
     buffer[2] = (value >>  8) & 255;
     buffer[3] = value & 255;
     return buffer;
   }
   makeCRCTable(){
      let c;
      for(var n = 0; n < 256; n++){
         c = n;
         for(var k = 0; k < 8; k++){
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
         }
         this.crcTable.push(c);
      }
   }
   filter0(){
      let i, j, count = 0;
      for(i = 0; i < this.scanlines.length; i++){
         this.scanlines[i] = new Uint8Array(this.widthScanline);
      }
      for(i = 0; i < this.h; i++){
         for(let j = 1; j < this.widthScanline; j++){
            this.scanlines[i][j] = this.data[count];
            count++;
         }
      }
      let filter = this.filter, aux = [];
      for(i = this.h - 1; i >= 0; i--){
         if(this.filter == 5){
            let minSum = Number.MAX_VALUE;
            for(let ft = 0; ft < 5; ft++){
               aux.push(this.filterScanline(ft, i, true));
               if(aux[aux.length - 1][1] < minSum){
                  minSum = aux[aux.length - 1][1];
                  filter = ft;
               }
            }
            this.scanlines[i] = aux[filter][0];
         }else{
            this.scanlines[i] = this.filterScanline(filter, i);
         }
      }
      count = 0;
      for(i = 0; i < this.h; i++){
         for(j = 0; j < this.widthScanline; j++){
            this.buffer[count] = this.scanlines[i][j];
            count++;
         }
      }
      return this.buffer;
   }
   paeth(a, b, c){
      let pa = Math.abs(b - c);
      let pb = Math.abs(a - c);
      let pc = Math.abs(a + b - c - c);
      if(pb < pa){
         a = b;
         pa = pb;
      }
      return (pc < pa) ? c : a;
   }
   filterScanline(type, scanlineId, returnSum){
      if(this.scanlines[scanlineId] === undefined) return console.error(`Scanline ${scanlineId} non-existent.`);
      let filtered = new Uint8Array(this.widthScanline), i, rawA, rawB, rawC;
      filtered[0] = type;
      switch(type){
         case 0:{
            filtered = this.scanlines[scanlineId];
            break;
         }
         case 1:{
            for(i = 1; i < this.widthScanline; i++){
               (i < (this.pixelSize + 1)) ? filtered[i] = this.scanlines[scanlineId][i] : filtered[i] = this.scanlines[scanlineId][i] - this.scanlines[scanlineId][i - this.pixelSize];
            }
            break;
         }
         case 2:{
            if(scanlineId == 0){
               filtered = this.scanlines[scanlineId];
            }else{
               for(i = 1; i < this.widthScanline; i++) filtered[i] = this.scanlines[scanlineId][i] - this.scanlines[scanlineId - 1][i];
            }
            break;
         }
         case 3:{
            for(i = 1; i < this.widthScanline; i++){
               (i > this.pixelSize) ? rawA = this.scanlines[scanlineId][i - this.pixelSize] : rawA = 0;
               (scanlineId > 0) ? rawB = this.scanlines[scanlineId - 1][i] : rawB = 0;
               filtered[i] = this.scanlines[scanlineId][i] - Math.floor((rawA + rawB) / 2);
            }
            break;
         }
         case 4:{
            for(let i = 1; i < this.widthScanline; i++){
               (i > this.pixelSize) ? rawA = this.buffer[scanlineId][i - this.pixelSize] : rawA = 0;
               (scanlineId > 0) ? rawB = this.scanlines[scanlineId - 1][i] : rawB = 0;
               (i > this.pixelSize && scanlineId > 0) ? rawC = this.scanlines[scanlineId - 1][i - this.pixelSize] : rawC = 0;
               filtered[i] = this.scanlines[scanlineId][i] - this.paeth(rawA, rawB, rawC);
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
      if(this.crcTable.length == 0) this.makeCRCTable();
      var crc = -1;
      for(let i = 0; i < data.length; i++){
         crc = (crc >>> 8) ^ this.crcTable[(crc ^ data[i]) & 255];
      }
      return (crc ^ (-1)) >>> 0;
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
            var cp = new Uint8Array(c);
            this.idat = new Uint8Array(cp.length + 12);
            this.idat.set(this.set32bit(cp.length));
            this.idat.set([73, 68, 65, 84], 4);
            this.idat.set(cp, 8);
            this.idat.set(this.set32bit(this.getCRC32(this.idat.slice(4, 8 + cp.length))), cp.length + 8);
               this.blob = new Blob([this.signature, this.ihdr, this.idat, this.iend], {type: "image/png"});
               resolve(this.blob);
         });
      });
   }
}