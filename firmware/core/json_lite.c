#include "json_lite.h"

#include <string.h>

/* Skips a JSON string starting at s[i]=='"'; returns index after closing quote. */
static size_t skip_string(const char *s, size_t n, size_t i) {
  i++;
  while (i < n && s[i] != '"') {
    if (s[i] == '\\' && i + 1 < n) i++;
    i++;
  }
  return i < n ? i + 1 : n;
}

int json_next_object(const char *json, size_t *pos, const char **start, size_t *len) {
  size_t n = strlen(json), i = *pos;
  while (i < n && json[i] != '{') {
    if (json[i] == ']') return 0;
    i++;
  }
  if (i >= n) return 0;

  size_t begin = i;
  int depth = 0;
  for (; i < n; i++) {
    char c = json[i];
    if (c == '"') { i = skip_string(json, n, i) - 1; continue; }
    if (c == '{') depth++;
    else if (c == '}' && --depth == 0) {
      *start = json + begin;
      *len = i - begin + 1;
      *pos = i + 1;
      return 1;
    }
  }
  return 0;
}

/* Locates the value of a depth-1 key. Returns index of first value char or 0. */
static size_t find_value(const char *obj, size_t len, const char *key) {
  size_t klen = strlen(key);
  int depth = 0;
  for (size_t i = 0; i < len; i++) {
    char c = obj[i];
    if (c == '{' || c == '[') { depth++; continue; }
    if (c == '}' || c == ']') { depth--; continue; }
    if (c != '"') continue;

    size_t end = skip_string(obj, len, i); /* one past closing quote */
    int is_key = 0;
    if (depth == 1) {
      size_t j = end;
      while (j < len && (obj[j] == ' ' || obj[j] == '\n' || obj[j] == '\t')) j++;
      is_key = j < len && obj[j] == ':';
      if (is_key && end - i - 2 == klen && strncmp(obj + i + 1, key, klen) == 0) {
        j++;
        while (j < len && (obj[j] == ' ' || obj[j] == '\n' || obj[j] == '\t')) j++;
        return j;
      }
    }
    i = end - 1;
  }
  return 0;
}

int json_get_string(const char *obj, size_t len, const char *key, char *out, size_t out_size) {
  size_t v = find_value(obj, len, key);
  if (!v || obj[v] != '"') return 0;
  size_t o = 0;
  for (size_t i = v + 1; i < len && obj[i] != '"'; i++) {
    if (obj[i] == '\\' && i + 1 < len) i++;
    if (o + 1 < out_size) out[o++] = obj[i];
  }
  if (out_size) out[o] = '\0';
  return 1;
}

int json_get_bool(const char *obj, size_t len, const char *key, int *out) {
  size_t v = find_value(obj, len, key);
  if (!v) return 0;
  if (strncmp(obj + v, "true", 4) == 0) { *out = 1; return 1; }
  if (strncmp(obj + v, "false", 5) == 0) { *out = 0; return 1; }
  return 0;
}
