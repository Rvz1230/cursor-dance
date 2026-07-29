#include <ApplicationServices/ApplicationServices.h>
#include <signal.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static bool cursor_hidden = false;

static void emit_status(const char *status) {
  fputs(status, stdout);
  fputc('\n', stdout);
  fflush(stdout);
}

static void set_cursor_hidden(bool next_hidden) {
  if (next_hidden == cursor_hidden) return;

  if (next_hidden) {
    CGDisplayHideCursor(kCGDirectMainDisplay);
  } else {
    CGDisplayShowCursor(kCGDirectMainDisplay);
  }
  cursor_hidden = next_hidden;
}

static void restore_cursor(void) {
  set_cursor_hidden(false);
  emit_status("shown");
}

static void handle_termination_signal(int signal_number) {
  set_cursor_hidden(false);
  (void)write(STDOUT_FILENO, "shown\n", 6);
  _Exit(128 + signal_number);
}

int main(void) {
  setvbuf(stdout, NULL, _IONBF, 0);
  atexit(restore_cursor);
  signal(SIGINT, handle_termination_signal);
  signal(SIGTERM, handle_termination_signal);
  signal(SIGHUP, handle_termination_signal);

  emit_status("ready");
  char command[16];
  while (fgets(command, sizeof(command), stdin) != NULL) {
    command[strcspn(command, "\r\n")] = '\0';
    if (strcmp(command, "hide") == 0) {
      set_cursor_hidden(true);
      emit_status("hidden");
    } else if (strcmp(command, "show") == 0) {
      set_cursor_hidden(false);
      emit_status("shown");
    } else if (strcmp(command, "recover") == 0) {
      CGDisplayShowCursor(kCGDirectMainDisplay);
      cursor_hidden = false;
      emit_status("shown");
    } else if (strcmp(command, "ping") == 0) {
      emit_status("pong");
    } else if (strcmp(command, "quit") == 0) {
      break;
    }
  }

  return EXIT_SUCCESS;
}
