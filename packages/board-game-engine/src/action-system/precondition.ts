export interface Precondition<ActionContext> {
    check(context: ActionContext): boolean;
    getErrorMessage(context: ActionContext): string;
}

