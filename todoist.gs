/**
 * This function can be run independently of the trigger function.  It sets the 
 * values used by the trigger function.
 */
function configure_todoist() {
  var props = PropertiesService.getUserProperties();

  props.setProperty( 'user_id'      , '' );  // Shortcode to use current GMail account
  props.setProperty( 'do_all'       , false );    // If true, `job_interval` is ignored
  props.setProperty( 'job_interval' , 5 );     // Match this value to the trigger function's frequency
  props.setProperty( 'todoist_label', '' );  // Label in Gmail used to identify ToDoist-flagged messages
  props.setProperty( 'recipient'    , '' );  // Email to ToDoist
}

/**
 * Attach a trigger to this function to run every 'job_interval' minutes
 *
 * NOTE:   This function requires that the GMail API be activated in the project.
 *
 * NOTE+:  Activating the GMail API has to be done in two places (enable the API for the
 *         project, and enable the API for the script).
 */
function process_todoist() {
  console.info('Initializing...');
  
  var props     = PropertiesService.getUserProperties();
  var userID    = props.getProperty('user_id');
  var do_all    = new Boolean(props.getProperty('do_all'));
  var interval  = parseInt( props.getProperty('job_interval') );
  var todoist   = props.getProperty('todoist_label');
  var recipient = props.getProperty('recipient');

  /**
   * Oldest message date to look at is 110% of `interval` (slight overlap to catch things that may fall 
   * "on the line" between runs)  
   */
  var oldest    = do_all ? false : new Date((new Date()).getTime() - ( 1000 * 60 * ( interval * 1.1 ) ));
  var labelList = Gmail.Users.Labels.list(userID);

  threads = GmailApp.getInboxThreads();

  for ( var i = 0; i < threads.length; i++ ) {
    thread = threads[i];
    
    // Stop if we've gotten too old
    if ( !do_all && ( thread.getLastMessageDate() < oldest ) ) {
      console.info('Thread old.  Exiting.');
      return;
    }
    
    var labels = thread.getLabels();
    var stop_processing = false;
    
    for ( var j = 0; j < labels.length; j++ ) {
      // Process ToDoist labels only
      if ( labels[j].getName() === todoist ) {  
        console.info('Processing ToDoist on thread ' + i + '...');

        try {
          console.info('Sending email...');

          // Thread has been flagged for ToDoist, so send ToDoist an email
          thread.getMessages()[0].forward(recipient);  // Forward 1st message of thread

          console.info('archiving...');
          // Archive the thread
          thread.moveToArchive();
        } catch (e) {
          // More than likely, this is because we hit the forward() limit for the day (250 messages).
          // Right now, do nothing.  In future, we may wish to adjust the interval when this happens to 
          // make sure that we pick up any todos that weren't successfully submitted to ToDoist
          console.warn("Unable to send email.  Odds are, we've hit the daily cap.");
          stop_processing = true;
        }
        
        // Don't process any more labels if we've found ToDoist.
        if ( stop_processing ) {
          console.info( 'Stopping label processing (found ToDoist).' );
          break; 
        }
      }
    }
    
    // Don't process any more threads if we've hit an email error (i.e. hit the daily cap)
    if ( stop_processing ) {
      console.info( "Stopping all processing (couldn't email ToDoist)." );
      break;
    }

    console.info('complete');
  }
}
