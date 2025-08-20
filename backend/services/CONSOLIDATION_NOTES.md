# PDF Service Consolidation - Backup Files

This directory contains backup files from the PDF service consolidation process.

## Original Files Replaced:
- `PDFRoutineService_OLD.js` - Original PDFRoutineService with duplicate code
- `pdf_DEPRECATED.js` - Original PDF routes (moved to routine.js)

## Files to be Removed:
- `backend/utils/pdfGeneration.js` - Consolidated into UnifiedPDFService
- `backend/utils/roomPdfGeneration.js` - Consolidated into UnifiedPDFService  
- `backend/utils/teacherPdfGeneration.js` - Consolidated into UnifiedPDFService

## Key Changes Made:
1. **Time Slot Mapping Fix**: Fixed critical bug where `slotIndex` was used as array index instead of mapping to `TimeSlot._id`
2. **Code Consolidation**: Merged all PDF generation logic into single UnifiedPDFService
3. **Route Consolidation**: Moved all PDF routes to routine.js, deprecated separate pdf.js
4. **Unified fillRoutineData**: Single method replaces multiple duplicate implementations

## Time Slot Bug Details:
- **Before**: `timeSlots[slotIndex - 1]` (WRONG - used array index)
- **After**: `timeSlots.find(ts => ts._id === slotIndex)` (CORRECT - maps to actual TimeSlot)
- **Impact**: Fixes issue where adding new time slots would shift array order but break existing class mappings
