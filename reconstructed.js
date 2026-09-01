   if (lines[i].includes('[diff_block_end]')) {
       capturing = true;
   }
   if (capturing) {
       diffBlock = lines[i] + '\
   }
   if (capturing && lines[i].includes('[diff_block_start]')) {
       break; // found the block
   }
   if (line.startsWith('-') && !line.startsWith('---')) {
       reconstructed += line.substring(1) + '\
   } else if (line.startsWith(' ') && !line.startsWith('@@')) {
       // unchanged lines
       reconstructed += line.substring(1) + '\
   }
