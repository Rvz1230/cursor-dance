#include <ApplicationServices/ApplicationServices.h>
#include <signal.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static bool cursor_hidden = false;

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
}

static void handle_termination_signal(int signal_number) {
  restore_cursor();
  _Exit(128 + signal_number);
}

int main(void) {
  atexit(restore_cursor);
  signal(SIGINT, handle_termination_signal);
  signal(SIGTERM, handle_termination_signal);
  signal(SIGHUP, handle_termination_signal);

  char command[16];
  while (fgets(command, sizeof(command), stdin) != NULL) {
    command[strcspn(command, "\r\n")] = '\0';
    if (strcmp(command, "hide") == 0) {
      set_cursor_hidden(true);
    } else if (strcmp(command, "show") == 0) {
      set_cursor_hidden(false);
    } else if (strcmp(command, "quit") == 0) {
      break;
    }
  }

  return EXIT_SUCCESS;
}
