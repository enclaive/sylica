#include <Base.h>
#include <Library/DebugLib.h>
#include <Library/MemoryAllocationLib.h>

#define MAXIMUM 10

typedef struct
{
} TESTS;

UINT32
ReadSomewhere ()
{
  return 10;
}

VOID *
DoSomething (UINT32 Size)
{
  return AllocatePool (Size);
}

BOOLEAN
TestBadA ()
{
  const UINT32 Count = ReadSomewhere ();
  const UINT32 DirSize = Count * sizeof (TESTS);
  TESTS *DirEntry = DoSomething (DirSize);
  if (DirEntry == NULL) {
    return FALSE;
  }
  return TRUE;
}

BOOLEAN
TestBadB ()
{
  const UINT32 Count = ReadSomewhere ();
  TESTS *DirEntry = DoSomething (Count * sizeof (TESTS));
  if (DirEntry == NULL) {
    return FALSE;
  }
  return TRUE;
}

BOOLEAN
TestBadC ()
{
  const UINT32 Count = ReadSomewhere ();
  TESTS *DirEntry = DoSomething (sizeof (TESTS) * Count);
  if (DirEntry == NULL)
    return FALSE;
  return TRUE;
}

BOOLEAN
TestGoodA ()
{
  const UINT32 Count = ReadSomewhere ();
  if (Count > MAXIMUM) {
    DEBUG ((DEBUG_ERROR, "%a: validate: too large %d\n", __func__, Count));
    return FALSE;
  }
  const UINT32 DirSize = Count * sizeof (TESTS);
  TESTS *DirEntry = DoSomething (DirSize);
  if (DirEntry == NULL) {
    return FALSE;
  }
  return TRUE;
}

BOOLEAN
TestGoodB ()
{
  const UINT32 Count = ReadSomewhere ();
  if (Count > MAXIMUM) {
    DEBUG ((DEBUG_ERROR, "%a: validate: too large %d\n", __func__, Count));
    return FALSE;
  }
  TESTS *DirEntry = DoSomething (Count * sizeof (TESTS));
  if (DirEntry == NULL) {
    return FALSE;
  }
  return TRUE;
}

BOOLEAN
TestGoodC ()
{
  const UINT32 Count = ReadSomewhere ();
  if (Count > MAXIMUM)
    return FALSE;
  TESTS *DirEntry = DoSomething (sizeof (TESTS) * Count);
  if (DirEntry == NULL) {
    return FALSE;
  }
  return TRUE;
}
