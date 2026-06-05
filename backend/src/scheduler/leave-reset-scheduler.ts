import { performAnnualLeaveReset } from "../modules/leaves/leave-reset.service";

function isAprilFirst(date: Date): boolean {
  return date.getUTCMonth() === 3 && date.getUTCDate() === 1;
}

export function initializeLeaveResetScheduler(): void {
  // Check every day at 2:00 AM UTC for April 1st
  const schedule = () => {
    const now = new Date();
    console.log('Running daily scheduler check for annual leave reset...');
    
    if (isAprilFirst(now)) {
      console.log('April 1st detected! Performing annual leave reset...');
      performAnnualLeaveReset()
        .then(() => {
          console.log('Annual leave reset completed successfully.');
        })
        .catch((error) => {
          console.error('Error during annual leave reset:', error);
        });
    } else {
      console.log('Not April 1st, skipping annual reset.');
    }
  };

  // Run immediately on startup (in case server was restarted on April 1st)
  schedule();
  
  // Schedule to run daily at 2:00 AM UTC
  setInterval(() => {
    schedule();
  }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
}
