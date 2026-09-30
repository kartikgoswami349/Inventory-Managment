export interface TransactionRecipientSession {
  departmentId: string;
  departmentName: string;

  personId: string;
  personName: string;

  otherName: string;
}


/*
  Temporary batch transaction recipient.

  This exists only while the app's
  JavaScript session is running.

  It is NOT stored in SQLite and
  is NOT synchronized to other phones.
*/

let currentRecipientSession:
  TransactionRecipientSession |
  null =
  null;


export function
  setTransactionRecipientSession(
    session:
      TransactionRecipientSession
  ) {

  currentRecipientSession = {
    ...session,
  };
}


export function
  getTransactionRecipientSession():
    TransactionRecipientSession |
    null {

  if (!currentRecipientSession) {
    return null;
  }


  /*
    Return a copy so screens cannot
    accidentally modify the stored
    session object directly.
  */

  return {
    ...currentRecipientSession,
  };
}


export function
  clearTransactionRecipientSession() {

  currentRecipientSession =
    null;
}