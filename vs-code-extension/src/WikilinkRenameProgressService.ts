import * as vscode from 'vscode';

export interface RenameProgressReporter {
    report(message: string): void;
}

export async function withWikilinkRenameProgress<T>(
    title: string,
    task: (progress: RenameProgressReporter) => Promise<T>,
): Promise<T> {
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false,
        },
        async (progress) => task({
            report(message: string) {
                progress.report({ message });
            },
        }),
    );
}