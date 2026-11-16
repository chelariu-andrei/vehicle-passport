/** A device file ready to attach: a local uri (jpeg, png or pdf, at most 10 MB) and its size in bytes. */
export type PreparedFile = { uri: string; size: number };
