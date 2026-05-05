import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';
import { useTheme } from '@fluentui/react/lib/Theme';

interface ErrorStateProps {
    message: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message }) => {
    const theme = useTheme();

    const styles = mergeStyleSets({
        root: {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            color: theme.palette.redDark,
            fontSize: theme.fonts.small.fontSize as string,
            border: `1px solid ${theme.palette.redDark}`,
            borderRadius: 2,
            backgroundColor: theme.palette.white,
        },
    });

    return (
        <div className={styles.root} role="alert" aria-live="assertive">
            <Icon iconName="ErrorBadge" />
            <span>{message}</span>
        </div>
    );
};
