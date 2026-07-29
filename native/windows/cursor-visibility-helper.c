#define OEMRESOURCE
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static bool cursor_hidden = false;

static const DWORD system_cursor_ids[] = {
  OCR_NORMAL,
  OCR_IBEAM,
  OCR_WAIT,
  OCR_CROSS,
  OCR_UP,
  OCR_SIZENWSE,
  OCR_SIZENESW,
  OCR_SIZEWE,
  OCR_SIZENS,
  OCR_SIZEALL,
  OCR_NO,
  OCR_HAND,
  OCR_APPSTARTING,
  OCR_HELP,
};

static void emit_status(const char *status) {
  fputs(status, stdout);
  fputc('\n', stdout);
  fflush(stdout);
}

static HCURSOR create_transparent_cursor(void) {
  const int width = GetSystemMetrics(SM_CXCURSOR);
  const int height = GetSystemMetrics(SM_CYCURSOR);
  const size_t row_bytes = (size_t)((width + 15) / 16) * 2;
  const size_t mask_bytes = row_bytes * (size_t)height;
  BYTE *and_mask = (BYTE *)malloc(mask_bytes);
  BYTE *xor_mask = (BYTE *)calloc(mask_bytes, 1);
  if (and_mask == NULL || xor_mask == NULL) {
    free(and_mask);
    free(xor_mask);
    return NULL;
  }

  memset(and_mask, 0xFF, mask_bytes);
  HCURSOR cursor = CreateCursor(
    GetModuleHandleW(NULL),
    0,
    0,
    width,
    height,
    and_mask,
    xor_mask
  );
  free(and_mask);
  free(xor_mask);
  return cursor;
}

static bool restore_system_cursors(void) {
  const BOOL restored = SystemParametersInfoW(SPI_SETCURSORS, 0, NULL, 0);
  cursor_hidden = false;
  return restored != FALSE;
}

static bool hide_system_cursors(void) {
  if (cursor_hidden) return true;

  for (size_t index = 0; index < sizeof(system_cursor_ids) / sizeof(system_cursor_ids[0]); index += 1) {
    HCURSOR transparent_cursor = create_transparent_cursor();
    if (transparent_cursor == NULL) {
      restore_system_cursors();
      return false;
    }
    if (!SetSystemCursor(transparent_cursor, system_cursor_ids[index])) {
      DestroyCursor(transparent_cursor);
      restore_system_cursors();
      return false;
    }
  }

  cursor_hidden = true;
  return true;
}

static void restore_on_exit(void) {
  if (cursor_hidden) restore_system_cursors();
  emit_status("shown");
}

int main(void) {
  setvbuf(stdout, NULL, _IONBF, 0);
  atexit(restore_on_exit);
  emit_status("ready");

  char command[16];
  while (fgets(command, sizeof(command), stdin) != NULL) {
    command[strcspn(command, "\r\n")] = '\0';
    if (strcmp(command, "hide") == 0) {
      if (hide_system_cursors()) emit_status("hidden");
      else emit_status("error");
    } else if (strcmp(command, "show") == 0) {
      if (cursor_hidden && !restore_system_cursors()) emit_status("error");
      else emit_status("shown");
    } else if (strcmp(command, "recover") == 0) {
      if (restore_system_cursors()) emit_status("shown");
      else emit_status("error");
    } else if (strcmp(command, "ping") == 0) {
      emit_status("pong");
    } else if (strcmp(command, "quit") == 0) {
      break;
    }
  }

  return EXIT_SUCCESS;
}
