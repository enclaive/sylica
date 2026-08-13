#include <Base.h>
#include <Library/MemoryAllocationLib.h>

typedef struct {} TEST;
static UINTN Count = 10;

VOID
Main ()
{
  TEST *t = AllocatePool (Count);
}

VOID
Okay1 ()
{
  TEST *t = AllocatePool (Count);
  if (t == NULL) {
    return;
  }
}

VOID
Test ()
{
  TEST *t;
  t = AllocatePool (Count);
}

VOID
Okay2 ()
{
  TEST *t;
  t = AllocatePool (Count);
  if (t == NULL) {
    return;
  }
}
