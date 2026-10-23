import React from 'react';
import {View,Text,TextInput,TouchableOpacity,Switch} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import {Colors} from '../constants/theme';
import {WorkflowSchedule} from '../lib/types';
const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export default function WorkflowScheduleEditor({value,onChange}:{value:WorkflowSchedule|null;onChange:(value:WorkflowSchedule|null)=>void}) {
 const {isDark}=useTheme();const colors=isDark?Colors.dark:Colors.light;
 const input={borderWidth:1,borderColor:colors.border,borderRadius:10,padding:12,color:colors.text,backgroundColor:colors.card};
 return <View style={{gap:12,marginBottom:24}}>
  <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontWeight:'600',color:colors.text}}>Repeat automatically</Text><Switch value={!!value} onValueChange={checked=>onChange(checked?{days:[1,2,3,4,5],time:'10:00',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:true}:null)}/></View>
  {value&&<>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{days.map((day,index)=><TouchableOpacity key={day} accessibilityRole="button" accessibilityState={{selected:value.days.includes(index)}} accessibilityLabel={`Repeat on ${day}`} onPress={()=>onChange({...value,days:value.days.includes(index)?value.days.filter(d=>d!==index):[...value.days,index].sort()})} style={{borderWidth:1,borderColor:colors.border,borderRadius:8,padding:10,backgroundColor:value.days.includes(index)?colors.primary:colors.card}}><Text style={{color:value.days.includes(index)?colors.primaryForeground:colors.text}}>{day}</Text></TouchableOpacity>)}</View>
   <Text style={{color:colors.textMuted}}>Time (24-hour HH:mm)</Text><TextInput accessibilityLabel="Schedule time" value={value.time} onChangeText={time=>onChange({...value,time})} style={input} placeholder="10:00" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" maxLength={5}/>
   <Text style={{color:colors.textMuted}}>Time zone</Text><TextInput accessibilityLabel="Schedule time zone" value={value.timeZone} onChangeText={timeZone=>onChange({...value,timeZone})} style={input} autoCapitalize="none" autoCorrect={false}/>
   <Text style={{fontSize:12,lineHeight:18,color:colors.textMuted}}>Records automatically from the next scheduled time after syncing. “Not today” on Home skips or undoes one day. This time zone stays fixed.</Text>
  </>}
 </View>;
}
